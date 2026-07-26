import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MerchantStatus,
  Prisma,
  SavedItemKind,
  StoreType,
} from '@prisma/client';
import { PaginationService } from '../../../platform/api/pagination/pagination.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  haversineKm,
  isWithinOpeningHours,
  toNumber,
} from '../domain/geo.util';

export interface VerticalListQuery {
  readonly search?: string;
  readonly q?: string;
  readonly category?: string;
  readonly categorySlug?: string;
  readonly page?: string;
  readonly limit?: string;
  readonly pageSize?: string;
  readonly lat?: string;
  readonly lng?: string;
  readonly city?: string;
  readonly sort?: string;
  readonly openNow?: string;
  readonly minRating?: string;
  readonly featured?: string;
  readonly inStock?: string;
  readonly brand?: string;
  readonly minPrice?: string;
  readonly maxPrice?: string;
  readonly discount?: string;
  readonly size?: string;
  readonly serviceType?: string;
}

export interface StoreCardView {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly city: string | null;
  readonly image: string | null;
  readonly imageUrl: string | null;
  readonly coverImage: string | null;
  readonly logo: string | null;
  readonly rating: number;
  readonly reviewCount: number;
  readonly reviews: number;
  readonly deliveryTimeMin: number;
  readonly deliveryTimeMax: number;
  readonly deliveryFee: number;
  readonly minimumOrder: number | null;
  readonly distanceKm: number;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly isOpen: boolean;
  readonly open: boolean;
  readonly ageRestricted: boolean;
  readonly isFavourite: boolean;
  readonly isFavorite: boolean;
  readonly categories: readonly string[];
  readonly categorySlugs: readonly string[];
  readonly tags: readonly { readonly text: string }[];
  readonly navigation: { readonly route: string };
}

const NAV_PREFIX: Record<string, string> = {
  MARKET: '/local-markets',
  LIQUOR: '/liquor-store',
  GAS: '/gas-store',
  RESTAURANT: '/restaurant',
};

const FAV_KIND: Partial<Record<StoreType, SavedItemKind>> = {
  MARKET: SavedItemKind.MARKET,
  LIQUOR: SavedItemKind.MERCHANT,
  GAS: SavedItemKind.MERCHANT,
  RESTAURANT: SavedItemKind.RESTAURANT,
};

@Injectable()
export class VerticalStoreDiscoveryService {
  private readonly pagination = new PaginationService(10, 50);

  public constructor(private readonly prisma: PrismaService) {}

  public async list(
    storeType: StoreType,
    query: VerticalListQuery,
    userId?: string,
  ): Promise<{
    items: StoreCardView[];
    page: number;
    hasMore: boolean;
    total: number;
    markets?: StoreCardView[];
    stores?: StoreCardView[];
  }> {
    const { page, limit } = this.pagination.normalizeOffset({
      page: query.page ? Number(query.page) : 1,
      limit: query.limit
        ? Number(query.limit)
        : query.pageSize
          ? Number(query.pageSize)
          : 10,
    });
    const search = (query.search ?? query.q ?? '').trim();
    const category = (query.category ?? query.categorySlug ?? '').trim();
    const city = (query.city ?? '').trim();
    const sort = (query.sort ?? 'recommended').trim();
    const openNow = query.openNow === '1' || query.openNow === 'true';
    const lat = query.lat ? Number(query.lat) : undefined;
    const lng = query.lng ? Number(query.lng) : undefined;
    const featured = query.featured === '1' || query.featured === 'true';
    const minRating = query.minRating ? Number(query.minRating) : undefined;

    const where: Prisma.StoreWhereInput = {
      deletedAt: null,
      isActive: true,
      storeType,
      merchant: {
        deletedAt: null,
        status: MerchantStatus.ACTIVE,
        ...(featured ? { featured: true } : {}),
      },
      ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}),
      ...(minRating !== undefined && Number.isFinite(minRating)
        ? { ratingAvg: { gte: minRating } }
        : {}),
      ...(category && category.toLowerCase() !== 'all'
        ? {
            OR: [
              { tags: { has: category } },
              {
                categories: {
                  some: {
                    deletedAt: null,
                    isActive: true,
                    OR: [
                      { slug: category },
                      { name: { equals: category, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { tags: { has: search } },
              {
                products: {
                  some: {
                    deletedAt: null,
                    isActive: true,
                    name: { contains: search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const needsInMemory =
      openNow ||
      ((sort === 'distance' || sort === 'nearest') &&
        lat !== undefined &&
        lng !== undefined);

    const paginationArgs = needsInMemory
      ? { skip: undefined as number | undefined, take: 500 }
      : { skip: (page - 1) * limit, take: limit };

    const stores = await this.prisma.store.findMany({
      where,
      include: {
        openingHours: true,
        categories: {
          where: { deletedAt: null, isActive: true },
          select: { name: true, slug: true },
        },
      },
      orderBy: this.orderBy(sort),
      skip: paginationArgs.skip,
      take: paginationArgs.take,
    });

    const totalCount = needsInMemory
      ? undefined
      : await this.prisma.store.count({ where });

    const favKind = FAV_KIND[storeType];
    const favouriteIds = userId && favKind
      ? new Set(
          (
            await this.prisma.savedItem.findMany({
              where: { userId, kind: favKind },
              select: { targetId: true },
            })
          ).map((row) => row.targetId),
        )
      : new Set<string>();

    let mapped = stores.map((store) =>
      this.toCard(store, storeType, favouriteIds.has(store.id), lat, lng),
    );
    if (openNow) mapped = mapped.filter((item) => item.isOpen);
    if (
      (sort === 'distance' || sort === 'nearest') &&
      lat !== undefined &&
      lng !== undefined
    ) {
      mapped = [...mapped].sort(
        (a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id),
      );
    }

    const total = needsInMemory ? mapped.length : (totalCount ?? mapped.length);
    const offset = (page - 1) * limit;
    const items = needsInMemory
      ? mapped.slice(offset, offset + limit)
      : mapped;
    return {
      items,
      page,
      hasMore: offset + items.length < total,
      total,
      markets: storeType === StoreType.MARKET ? items : undefined,
      stores: storeType !== StoreType.MARKET ? items : undefined,
    };
  }

  /**
   * Cross-vertical merchant discovery (`GET /merchants`, `GET /merchants/feed`).
   * Same filters/pagination as {@link list}, but spans several `StoreType`s
   * and resolves favourites per-row since each vertical maps to a different
   * `SavedItemKind`.
   */
  public async listAcrossTypes(
    storeTypes: readonly StoreType[],
    query: VerticalListQuery,
    userId?: string,
  ): Promise<{
    items: StoreCardView[];
    page: number;
    hasMore: boolean;
    total: number;
  }> {
    const { page, limit } = this.pagination.normalizeOffset({
      page: query.page ? Number(query.page) : 1,
      limit: query.limit
        ? Number(query.limit)
        : query.pageSize
          ? Number(query.pageSize)
          : 10,
    });
    const search = (query.search ?? query.q ?? '').trim();
    const category = (query.category ?? query.categorySlug ?? '').trim();
    const city = (query.city ?? '').trim();
    const sort = (query.sort ?? 'recommended').trim();
    const openNow = query.openNow === '1' || query.openNow === 'true';
    const lat = query.lat ? Number(query.lat) : undefined;
    const lng = query.lng ? Number(query.lng) : undefined;
    const featured = query.featured === '1' || query.featured === 'true';
    const minRating = query.minRating ? Number(query.minRating) : undefined;

    const where: Prisma.StoreWhereInput = {
      deletedAt: null,
      isActive: true,
      storeType: { in: [...storeTypes] },
      merchant: {
        deletedAt: null,
        status: MerchantStatus.ACTIVE,
        ...(featured ? { featured: true } : {}),
      },
      ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}),
      ...(minRating !== undefined && Number.isFinite(minRating)
        ? { ratingAvg: { gte: minRating } }
        : {}),
      ...(category && category.toLowerCase() !== 'all'
        ? {
            OR: [
              { tags: { has: category } },
              {
                categories: {
                  some: {
                    deletedAt: null,
                    isActive: true,
                    OR: [
                      { slug: category },
                      { name: { equals: category, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { tags: { has: search } },
            ],
          }
        : {}),
    };

    const stores = await this.prisma.store.findMany({
      where,
      include: {
        openingHours: true,
        categories: {
          where: { deletedAt: null, isActive: true },
          select: { name: true, slug: true },
        },
      },
      orderBy: this.orderBy(sort),
    });

    const favouriteIds = await this.favouriteIdsByKind(storeTypes, userId);

    let mapped = stores.map((store) =>
      this.toCard(
        store,
        store.storeType,
        favouriteIds.has(`${store.storeType}:${store.id}`),
        lat,
        lng,
      ),
    );
    if (openNow) mapped = mapped.filter((item) => item.isOpen);
    if (
      (sort === 'distance' || sort === 'nearest') &&
      lat !== undefined &&
      lng !== undefined
    ) {
      mapped = [...mapped].sort(
        (a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id),
      );
    }

    const total = mapped.length;
    const offset = (page - 1) * limit;
    const items = mapped.slice(offset, offset + limit);
    return {
      items,
      page,
      hasMore: offset + items.length < total,
      total,
    };
  }

  private async favouriteIdsByKind(
    storeTypes: readonly StoreType[],
    userId?: string,
  ): Promise<Set<string>> {
    if (!userId) return new Set<string>();
    const kinds = [
      ...new Set(
        storeTypes
          .map((type) => FAV_KIND[type])
          .filter((kind): kind is SavedItemKind => Boolean(kind)),
      ),
    ];
    if (kinds.length === 0) return new Set<string>();
    const rows = await this.prisma.savedItem.findMany({
      where: { userId, kind: { in: kinds } },
      select: { kind: true, targetId: true },
    });
    const byKindKey = new Set<string>();
    const kindToTypes = new Map<SavedItemKind, StoreType[]>();
    for (const type of storeTypes) {
      const kind = FAV_KIND[type];
      if (!kind) continue;
      kindToTypes.set(kind, [...(kindToTypes.get(kind) ?? []), type]);
    }
    for (const row of rows) {
      for (const type of kindToTypes.get(row.kind) ?? []) {
        byKindKey.add(`${type}:${row.targetId}`);
      }
    }
    return byKindKey;
  }

  public async getDetail(storeType: StoreType, storeId: string, userId?: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        storeType,
        deletedAt: null,
        isActive: true,
      },
      include: {
        openingHours: { orderBy: { day: 'asc' } },
        categories: {
          where: { deletedAt: null, isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        merchant: { select: { id: true, name: true, status: true } },
      },
    });
    if (!store) throw new NotFoundException('Store not found');

    const favKind = FAV_KIND[storeType];
    let isFavourite = false;
    if (userId && favKind) {
      const saved = await this.prisma.savedItem.findFirst({
        where: { userId, kind: favKind, targetId: storeId },
      });
      isFavourite = Boolean(saved);
    }

    const card = this.toCard(store, storeType, isFavourite);
    return {
      market: storeType === StoreType.MARKET ? {
        ...card,
        description: store.description,
        phone: store.phone,
        address: store.address,
        hours: store.openingHours.map((h) => ({
          day: h.day,
          open: h.openTime,
          close: h.closeTime,
          isClosed: h.isClosed,
        })),
      } : undefined,
      store: storeType !== StoreType.MARKET ? {
        ...card,
        description: store.description,
        phone: store.phone,
        address: store.address,
        whatsapp: store.whatsapp,
        hours: store.openingHours.map((h) => ({
          day: h.day,
          open: h.openTime,
          close: h.closeTime,
          isClosed: h.isClosed,
        })),
      } : undefined,
      categories: store.categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        imageUrl: c.imageUrl,
        icon: c.iconKey,
      })),
    };
  }

  private orderBy(sort: string): Prisma.StoreOrderByWithRelationInput[] {
    switch (sort) {
      case 'rating':
        return [{ ratingAvg: 'desc' }, { id: 'asc' }];
      case 'deliveryTime':
        return [{ deliveryTimeMin: 'asc' }, { id: 'asc' }];
      case 'newest':
        return [{ createdAt: 'desc' }, { id: 'asc' }];
      default:
        return [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }, { id: 'asc' }];
    }
  }

  private toCard(
    store: {
      id: string;
      name: string;
      city: string | null;
      imageUrl: string | null;
      coverImageUrl: string | null;
      latitude: unknown;
      longitude: unknown;
      deliveryFeeHint: bigint | null;
      minimumOrderAmount: bigint | null;
      deliveryTimeMin: number | null;
      deliveryTimeMax: number | null;
      ratingAvg: unknown;
      reviewCount: number;
      isOpen: boolean;
      ageRestricted: boolean;
      tags: string[];
      navigationRoute: string | null;
      openingHours?: readonly {
        day: string;
        openTime: string | null;
        closeTime: string | null;
        isClosed: boolean;
      }[];
      categories?: readonly { name: string; slug: string }[];
    },
    storeType: StoreType,
    isFavourite: boolean,
    lat?: number,
    lng?: number,
  ): StoreCardView {
    const storeLat = toNumber(store.latitude);
    const storeLng = toNumber(store.longitude);
    const distanceKm =
      lat !== undefined &&
      lng !== undefined &&
      storeLat !== null &&
      storeLng !== null
        ? Math.round(haversineKm(lat, lng, storeLat, storeLng) * 10) / 10
        : 0;
    const computedOpen = store.openingHours
      ? isWithinOpeningHours(store.openingHours)
      : store.isOpen;
    const isOpen = store.isOpen || computedOpen;
    const image = store.coverImageUrl ?? store.imageUrl;
    const prefix = NAV_PREFIX[storeType] ?? '/stores';
    const categoryNames =
      store.categories?.map((c) => c.name) ??
      (store.tags.length ? store.tags : ['General']);
    return {
      id: store.id,
      name: store.name,
      category: categoryNames[0] ?? 'General',
      city: store.city,
      image,
      imageUrl: image,
      coverImage: store.coverImageUrl,
      logo: store.imageUrl,
      rating: Number(store.ratingAvg),
      reviewCount: store.reviewCount,
      reviews: store.reviewCount,
      deliveryTimeMin: store.deliveryTimeMin ?? 20,
      deliveryTimeMax: store.deliveryTimeMax ?? 40,
      deliveryFee: store.deliveryFeeHint ? Number(store.deliveryFeeHint) : 0,
      minimumOrder: store.minimumOrderAmount
        ? Number(store.minimumOrderAmount)
        : null,
      distanceKm,
      latitude: storeLat,
      longitude: storeLng,
      lat: storeLat,
      lng: storeLng,
      isOpen,
      open: isOpen,
      ageRestricted: store.ageRestricted || storeType === StoreType.LIQUOR,
      isFavourite,
      isFavorite: isFavourite,
      categories: categoryNames,
      categorySlugs: store.categories?.map((c) => c.slug) ?? store.tags,
      tags: store.tags.map((text) => ({ text })),
      navigation: {
        route: store.navigationRoute ?? `${prefix}/${store.id}`,
      },
    };
  }
}
