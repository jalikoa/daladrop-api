import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MerchantStatus,
  Prisma,
  ProductServiceType,
  SavedItemKind,
  StoreType,
} from '@prisma/client';
import { PaginationService } from '../../../platform/api/pagination/pagination.service';
import { PrismaService } from '../../../database/prisma/prisma.service';

export interface ProductListQuery {
  readonly search?: string;
  readonly q?: string;
  readonly category?: string;
  readonly brand?: string;
  readonly minPrice?: string | number;
  readonly maxPrice?: string | number;
  readonly discount?: string;
  readonly inStock?: string;
  readonly size?: string;
  readonly serviceType?: string;
  readonly storeId?: string;
  readonly featured?: string;
  readonly sort?: string;
  readonly page?: string | number;
  readonly limit?: string | number;
}

const NAV_PREFIX: Partial<Record<StoreType, string>> = {
  MARKET: '/local-markets',
  LIQUOR: '/liquor-store',
  GAS: '/gas-store',
};

@Injectable()
export class StoreProductsService {
  private readonly pagination = new PaginationService(20, 50);

  public constructor(private readonly prisma: PrismaService) {}

  public listByStore(
    storeId: string,
    query: ProductListQuery,
    userId?: string,
  ) {
    return this.list(undefined, { ...query, storeId }, userId);
  }

  public async list(
    storeType: StoreType | undefined,
    query: ProductListQuery,
    userId?: string,
  ) {
    const { page, limit } = this.pagination.normalizeOffset({
      page: query.page !== undefined ? Number(query.page) : 1,
      limit: query.limit !== undefined ? Number(query.limit) : 20,
    });
    const where = this.buildWhere(storeType, query);
    const sort = (query.sort ?? 'recommended').trim();

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          store: {
            select: {
              id: true,
              name: true,
              storeType: true,
              ageRestricted: true,
            },
          },
        },
        orderBy: this.orderBy(sort),
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const favouriteIds = await this.favouriteIds(
      userId,
      rows.map((row) => row.id),
    );

    const items = rows.map((row) =>
      this.toCard(row, favouriteIds.has(row.id)),
    );

    return {
      items,
      products: items,
      page,
      hasMore: page * limit < total,
      total,
    };
  }

  public async popularForFeed(
    storeType: StoreType,
    query: ProductListQuery,
    userId?: string,
    take = 12,
  ) {
    const result = await this.list(
      storeType,
      { ...query, page: 1, limit: take, sort: 'recommended' },
      userId,
    );
    return result.items;
  }

  public async getProduct(id: string, userId?: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null, isActive: true },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        store: {
          select: {
            id: true,
            name: true,
            storeType: true,
            ageRestricted: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!product || !product.store.isActive || product.store.deletedAt) {
      throw new NotFoundException('Product not found');
    }

    let isFavorite = false;
    if (userId) {
      const saved = await this.prisma.savedItem.findFirst({
        where: { userId, kind: SavedItemKind.PRODUCT, targetId: id },
        select: { id: true },
      });
      isFavorite = Boolean(saved);
    }

    return this.toCard(product, isFavorite);
  }

  public async snapshotForStore(
    storeId: string,
    userId?: string,
    take = 20,
  ) {
    const result = await this.listByStore(
      storeId,
      { page: 1, limit: take },
      userId,
    );
    return result.items;
  }

  private buildWhere(
    storeType: StoreType | undefined,
    query: ProductListQuery,
  ): Prisma.ProductWhereInput {
    const search = (query.search ?? query.q ?? '').trim();
    const category = (query.category ?? '').trim();
    const brand = (query.brand ?? '').trim();
    const size = (query.size ?? '').trim();
    const serviceTypeRaw = (query.serviceType ?? '').trim().toUpperCase();
    const storeId = (query.storeId ?? '').trim();
    const inStock =
      query.inStock === '1' ||
      query.inStock === 'true' ||
      query.inStock === '0' ||
      query.inStock === 'false'
        ? query.inStock === '1' || query.inStock === 'true'
        : undefined;
    const discountOnly =
      query.discount === '1' || query.discount === 'true';
    const minPrice =
      query.minPrice !== undefined && query.minPrice !== ''
        ? Number(query.minPrice)
        : undefined;
    const maxPrice =
      query.maxPrice !== undefined && query.maxPrice !== ''
        ? Number(query.maxPrice)
        : undefined;

    let serviceType: ProductServiceType | undefined;
    if (serviceTypeRaw) {
      const mapped =
        serviceTypeRaw === 'REFILL'
          ? ProductServiceType.REFILL
          : serviceTypeRaw === 'EXCHANGE'
            ? ProductServiceType.EXCHANGE
            : serviceTypeRaw === 'NEW'
              ? ProductServiceType.NEW
              : serviceTypeRaw === 'STANDARD'
                ? ProductServiceType.STANDARD
                : undefined;
      serviceType = mapped;
    }

    return {
      deletedAt: null,
      isActive: true,
      ...(inStock !== undefined ? { inStock } : {}),
      ...(discountOnly
        ? { discountPercent: { not: null, gt: 0 } }
        : {}),
      ...(brand ? { brand: { equals: brand, mode: 'insensitive' } } : {}),
      ...(size
        ? {
            OR: [
              { sizeLabel: { equals: size, mode: 'insensitive' } },
              { sizeLabel: { contains: size, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(serviceType ? { serviceType } : {}),
      ...((minPrice !== undefined && Number.isFinite(minPrice)) ||
      (maxPrice !== undefined && Number.isFinite(maxPrice))
        ? {
            priceAmount: {
              ...(minPrice !== undefined && Number.isFinite(minPrice)
                ? { gte: BigInt(Math.floor(minPrice)) }
                : {}),
              ...(maxPrice !== undefined && Number.isFinite(maxPrice)
                ? { lte: BigInt(Math.floor(maxPrice)) }
                : {}),
            },
          }
        : {}),
      ...(category && category.toLowerCase() !== 'all'
        ? {
            OR: [
              { categoryId: category },
              {
                category: {
                  deletedAt: null,
                  OR: [
                    { slug: category },
                    { name: { equals: category, mode: 'insensitive' } },
                  ],
                },
              },
              { tags: { has: category } },
            ],
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { brand: { contains: search, mode: 'insensitive' } },
              { sizeLabel: { contains: search, mode: 'insensitive' } },
              { tags: { has: search } },
              {
                store: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
      store: {
        deletedAt: null,
        isActive: true,
        ...(storeId ? { id: storeId } : {}),
        ...(storeType ? { storeType } : {}),
        merchant: {
          deletedAt: null,
          status: MerchantStatus.ACTIVE,
        },
      },
    };
  }

  private orderBy(
    sort: string,
  ): Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case 'priceAsc':
        return [{ priceAmount: 'asc' }, { id: 'asc' }];
      case 'priceDesc':
        return [{ priceAmount: 'desc' }, { id: 'asc' }];
      case 'discount':
        return [{ discountPercent: 'desc' }, { id: 'asc' }];
      case 'newest':
        return [{ createdAt: 'desc' }, { id: 'asc' }];
      default:
        return [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }];
    }
  }

  private async favouriteIds(userId: string | undefined, ids: string[]) {
    if (!userId || ids.length === 0) return new Set<string>();
    const rows = await this.prisma.savedItem.findMany({
      where: {
        userId,
        kind: SavedItemKind.PRODUCT,
        targetId: { in: ids },
      },
      select: { targetId: true },
    });
    return new Set(rows.map((row) => row.targetId));
  }

  private toCard(
    product: {
      id: string;
      storeId: string;
      categoryId: string | null;
      name: string;
      description: string | null;
      brand: string | null;
      sku: string | null;
      priceAmount: bigint;
      originalPrice: bigint | null;
      currency: string;
      discountPercent: number | null;
      imageUrl: string | null;
      inStock: boolean;
      ageRestricted: boolean;
      sizeLabel: string | null;
      volumeLabel: string | null;
      abv: unknown;
      country: string | null;
      unitLabel: string | null;
      serviceType: ProductServiceType | null;
      tags: string[];
      category?: { id: string; name: string; slug: string } | null;
      store: {
        id: string;
        name: string;
        storeType: StoreType;
        ageRestricted: boolean;
      };
    },
    isFavorite: boolean,
  ) {
    const prefix = NAV_PREFIX[product.store.storeType] ?? '/stores';
    const ageRestricted =
      product.ageRestricted ||
      product.store.ageRestricted ||
      product.store.storeType === StoreType.LIQUOR;
    const abv =
      product.abv === null || product.abv === undefined
        ? null
        : `${Number(product.abv)}%`;

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      brand: product.brand,
      sku: product.sku,
      price: Number(product.priceAmount),
      originalPrice:
        product.originalPrice !== null && product.originalPrice !== undefined
          ? Number(product.originalPrice)
          : null,
      currency: product.currency,
      discount: product.discountPercent,
      imageUrl: product.imageUrl,
      categoryId: product.categoryId ?? product.category?.id ?? null,
      categorySlug: product.category?.slug ?? null,
      categoryName: product.category?.name ?? null,
      inStock: product.inStock,
      isFavorite,
      isFavourite: isFavorite,
      storeId: product.storeId,
      storeName: product.store.name,
      unit: product.unitLabel,
      volume: product.volumeLabel,
      size: product.sizeLabel,
      abv,
      country: product.country,
      serviceType: product.serviceType
        ? product.serviceType.toLowerCase()
        : null,
      ageRestricted,
      tags: product.tags,
      navigation: {
        route: `${prefix}/${product.storeId}`,
      },
    };
  }
}
