import { Injectable, NotFoundException } from '@nestjs/common';
import { MerchantStatus, Prisma, StoreType } from '@prisma/client';
import { PaginationService } from '../../../platform/api/pagination/pagination.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  haversineKm,
  isWithinOpeningHours,
  toNumber,
} from '../domain/geo.util';
import type { RestaurantListQueryDto } from '../dto/merchants.dto';

export interface RestaurantCardView {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly cuisine: string;
  readonly city: string | null;
  readonly image: string | null;
  readonly imageUrl: string | null;
  readonly coverImage: string | null;
  readonly logo: string | null;
  readonly rating: number;
  readonly reviews: number;
  readonly reviewCount: number;
  readonly deliveryTimeMin: number;
  readonly deliveryTimeMax: number;
  readonly deliveryFee: number;
  readonly distanceKm: number;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly isOpen: boolean;
  readonly open: boolean;
  readonly isFavourite: boolean;
  readonly favorite: boolean;
  readonly tags: readonly {
    readonly text: string;
    readonly background?: string;
    readonly textColor?: string;
  }[];
  readonly navigation: { readonly route: string };
}

@Injectable()
export class RestaurantDiscoveryService {
  private readonly pagination = new PaginationService(10, 50);

  public constructor(private readonly prisma: PrismaService) {}

  public async list(
    query: RestaurantListQueryDto,
    userId?: string,
  ): Promise<{
    items: RestaurantCardView[];
    page: number;
    hasMore: boolean;
    total: number;
  }> {
    const { page, limit } = this.pagination.normalizeOffset({
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 10,
    });
    const search = (query.search ?? query.q ?? '').trim();
    const category = (query.category ?? '').trim();
    const city = (query.city ?? '').trim();
    const sort = (query.sort ?? 'recommended').trim();
    const openNow =
      query.openNow === '1' || query.openNow === 'true';
    const minRating = query.minRating ? Number(query.minRating) : undefined;
    const lat = query.lat ? Number(query.lat) : undefined;
    const lng = query.lng ? Number(query.lng) : undefined;
    const featured =
      query.featured === '1' || query.featured === 'true';

    const where: Prisma.StoreWhereInput = {
      deletedAt: null,
      isActive: true,
      storeType: StoreType.RESTAURANT,
      merchant: {
        deletedAt: null,
        status: MerchantStatus.ACTIVE,
        ...(featured ? { featured: true } : {}),
      },
      ...(city
        ? { city: { equals: city, mode: 'insensitive' } }
        : {}),
      ...(minRating !== undefined && Number.isFinite(minRating)
        ? { ratingAvg: { gte: minRating } }
        : {}),
      ...(category && category.toLowerCase() !== 'all'
        ? { tags: { has: category } }
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
        merchant: { select: { featured: true } },
      },
      orderBy: this.orderBy(sort),
    });

    const favouriteIds = userId
      ? new Set(
          (
            await this.prisma.savedItem.findMany({
              where: {
                userId,
                kind: 'RESTAURANT',
              },
              select: { targetId: true },
            })
          ).map((row) => row.targetId),
        )
      : new Set<string>();

    let mapped = stores.map((store) =>
      this.toCard(store, favouriteIds.has(store.id), lat, lng),
    );

    if (openNow) {
      mapped = mapped.filter((item) => item.isOpen);
    }

    if (sort === 'distance' && lat !== undefined && lng !== undefined) {
      mapped = [...mapped].sort(
        (a, b) =>
          a.distanceKm - b.distanceKm || a.id.localeCompare(b.id),
      );
    } else if (sort === 'recommended' && lat !== undefined && lng !== undefined) {
      mapped = [...mapped].sort((a, b) => {
        const score = (item: RestaurantCardView) =>
          (item.isOpen ? 1000 : 0) +
          item.rating * 100 -
          item.distanceKm * 10 +
          (item.reviewCount > 0 ? 5 : 0);
        return score(b) - score(a) || a.id.localeCompare(b.id);
      });
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

  public async getProfile(storeId: string, userId?: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        deletedAt: null,
        storeType: StoreType.RESTAURANT,
      },
      include: {
        openingHours: { orderBy: { day: 'asc' } },
        merchant: { select: { id: true, name: true, status: true, featured: true } },
      },
    });
    if (!store || !store.isActive) {
      throw new NotFoundException('Restaurant not found');
    }

    let isFavourite = false;
    if (userId) {
      const saved = await this.prisma.savedItem.findFirst({
        where: {
          userId,
          kind: 'RESTAURANT',
          targetId: storeId,
        },
      });
      isFavourite = Boolean(saved);
    }

    const computedOpen = isWithinOpeningHours(store.openingHours);
    const card = this.toCard(store, isFavourite);
    return {
      restaurant: {
        ...card,
        description: store.description,
        phone: store.phone,
        whatsapp: store.whatsapp,
        email: store.email,
        address: store.address,
        lat: card.latitude,
        lng: card.longitude,
        minimumOrder: store.minimumOrderAmount
          ? Number(store.minimumOrderAmount)
          : null,
        hours: store.openingHours.map((h) => ({
          day: h.day,
          open: h.openTime,
          close: h.closeTime,
          isClosed: h.isClosed,
        })),
        openingHours: store.openingHours.map((h) => ({
          day: h.day,
          open: h.openTime,
          close: h.closeTime,
          isClosed: h.isClosed,
        })),
        isOpen: store.isOpen || computedOpen,
        merchantId: store.merchantId,
      },
    };
  }

  private orderBy(
    sort: string,
  ): Prisma.StoreOrderByWithRelationInput[] {
    switch (sort) {
      case 'rating':
        return [{ ratingAvg: 'desc' }, { id: 'asc' }];
      case 'deliveryTime':
        return [{ deliveryTimeMin: 'asc' }, { id: 'asc' }];
      case 'newest':
        return [{ createdAt: 'desc' }, { id: 'asc' }];
      case 'distance':
      case 'recommended':
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
      deliveryTimeMin: number | null;
      deliveryTimeMax: number | null;
      ratingAvg: unknown;
      reviewCount: number;
      isOpen: boolean;
      tags: string[];
      navigationRoute: string | null;
      openingHours?: readonly {
        day: string;
        openTime: string | null;
        closeTime: string | null;
        isClosed: boolean;
      }[];
    },
    isFavourite: boolean,
    lat?: number,
    lng?: number,
  ): RestaurantCardView {
    const storeLat = toNumber(store.latitude);
    const storeLng = toNumber(store.longitude);
    const distanceKm =
      lat !== undefined &&
      lng !== undefined &&
      storeLat !== null &&
      storeLng !== null
        ? Math.round(haversineKm(lat, lng, storeLat, storeLng) * 10) / 10
        : 0;
    const category = store.tags[0] ?? 'Restaurant';
    const computedOpen = store.openingHours
      ? isWithinOpeningHours(store.openingHours)
      : store.isOpen;
    const isOpen = store.isOpen || computedOpen;
    const image = store.coverImageUrl ?? store.imageUrl;
    return {
      id: store.id,
      name: store.name,
      category,
      cuisine: category,
      city: store.city,
      image,
      imageUrl: image,
      coverImage: store.coverImageUrl,
      logo: store.imageUrl,
      rating: Number(store.ratingAvg),
      reviews: store.reviewCount,
      reviewCount: store.reviewCount,
      deliveryTimeMin: store.deliveryTimeMin ?? 20,
      deliveryTimeMax: store.deliveryTimeMax ?? 40,
      deliveryFee: store.deliveryFeeHint ? Number(store.deliveryFeeHint) : 0,
      distanceKm,
      latitude: storeLat,
      longitude: storeLng,
      isOpen,
      open: isOpen,
      isFavourite,
      favorite: isFavourite,
      tags: store.tags.map((text) => ({ text })),
      navigation: {
        route: store.navigationRoute ?? `/restaurant/${store.id}`,
      },
    };
  }
}
