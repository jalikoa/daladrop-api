import { Injectable, NotFoundException } from '@nestjs/common';
import { EventStatus, Prisma, SavedItemKind } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PaginationService } from '../../../platform/api/pagination/pagination.service';
import { haversineKm, toNumber } from '../../merchants/domain/geo.util';
import type { EventListQueryDto } from '../dto/events.dto';

type EventWithRelations = Prisma.EventGetPayload<{
  include: {
    category: true;
    ticketTypes: true;
  };
}>;

export interface EventCardView {
  readonly id: string;
  readonly name: string;
  readonly category: string | null;
  readonly categorySlug: string | null;
  readonly venue: string | null;
  readonly city: string | null;
  readonly image: string | null;
  readonly bannerUrl: string | null;
  readonly coverImageUrl: string | null;
  readonly startAt: string;
  readonly endAt: string | null;
  readonly rating: number;
  readonly reviewCount: number;
  readonly isFeatured: boolean;
  readonly priceFrom: number;
  readonly currency: string;
  readonly isFree: boolean;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly distanceKm: number;
  readonly isFavorite: boolean;
  readonly isFavourite: boolean;
  readonly navigation: { readonly route: string };
}

@Injectable()
export class EventsDiscoveryService {
  private readonly pagination = new PaginationService(10, 50);

  public constructor(private readonly prisma: PrismaService) {}

  public async listCategories() {
    const categories = await this.prisma.eventCategory.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const categoryViews = await Promise.all(
      categories.map(async (category) => {
        const count = await this.prisma.event.count({
          where: {
            categoryId: category.id,
            status: EventStatus.PUBLISHED,
            deletedAt: null,
          },
        });
        return {
          value: category.slug,
          label: category.name,
          slug: category.slug,
          ...(category.imageUrl ? { imageUrl: category.imageUrl } : {}),
          ...(category.iconKey ? { icon: category.iconKey } : {}),
          count,
        };
      }),
    );

    const total = await this.prisma.event.count({
      where: { status: EventStatus.PUBLISHED, deletedAt: null },
    });
    return {
      categories: [
        { value: 'all', label: 'All', slug: 'all', count: total },
        ...categoryViews,
      ],
    };
  }

  public async list(query: EventListQueryDto, userId?: string) {
    const { page, limit } = this.pagination.normalizeOffset({
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 10,
    });
    const search = (query.search ?? query.q ?? '').trim();
    const category = (query.category ?? '').trim();
    const city = (query.city ?? '').trim();
    const sort = this.normalizeSort((query.sort ?? 'soonest').trim());
    const featured = query.featured === '1' || query.featured === 'true';
    const freeOnly = query.free === '1' || query.free === 'true';
    const lat = query.lat ? Number(query.lat) : undefined;
    const lng = query.lng ? Number(query.lng) : undefined;
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;

    const where: Prisma.EventWhereInput = {
      status: EventStatus.PUBLISHED,
      deletedAt: null,
      ...(featured ? { isFeatured: true } : {}),
      ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}),
      ...(category && category.toLowerCase() !== 'all'
        ? { category: { slug: category } }
        : {}),
      ...(dateFrom || dateTo
        ? {
            startAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { venue: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const events = await this.prisma.event.findMany({
      where,
      include: { category: true, ticketTypes: true },
      orderBy: this.orderBy(sort),
    });

    const favouriteIds = await this.favouriteIds(userId);

    let mapped = events.map((event) =>
      this.toCard(event, favouriteIds.has(event.id), lat, lng),
    );

    if (freeOnly) {
      mapped = mapped.filter((item) => item.isFree);
    }

    if (sort === 'distance' && lat !== undefined && lng !== undefined) {
      mapped = [...mapped].sort(
        (a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id),
      );
    } else if (sort === 'priceAsc') {
      mapped = [...mapped].sort(
        (a, b) => a.priceFrom - b.priceFrom || a.id.localeCompare(b.id),
      );
    } else if (sort === 'priceDesc') {
      mapped = [...mapped].sort(
        (a, b) => b.priceFrom - a.priceFrom || a.id.localeCompare(b.id),
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

  public async getById(id: string, userId?: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, deletedAt: null },
      include: { category: true, ticketTypes: true },
    });
    if (!event || event.status !== EventStatus.PUBLISHED) {
      throw new NotFoundException('Event not found');
    }

    let isFavorite = false;
    if (userId) {
      const saved = await this.prisma.savedItem.findFirst({
        where: { userId, kind: SavedItemKind.EVENT, targetId: id },
      });
      isFavorite = Boolean(saved);
    }

    const card = this.toCard(event, isFavorite);
    const ticketTypes = event.ticketTypes
      .filter((tt) => tt.isActive && tt.deletedAt === null)
      .map((tt) => ({
        id: tt.id,
        name: tt.name,
        price: Number(tt.priceAmount),
        currency: tt.currency,
        totalQty: tt.totalQty,
        soldQty: tt.soldQty,
        availableQty: Math.max(0, tt.totalQty - tt.soldQty),
        isSoldOut: tt.totalQty - tt.soldQty <= 0,
      }));

    return {
      event: {
        ...card,
        description: event.description,
        address: event.address,
        gallery: event.gallery,
        ticketTypes,
      },
    };
  }

  public async feed(query: EventListQueryDto, userId?: string) {
    const [{ categories }, published] = await Promise.all([
      this.listCategories(),
      this.list({ ...query, page: '1', limit: '50', sort: 'soonest' }, userId),
    ]);

    const all = published.items;
    const byRating = [...all].sort((a, b) => b.rating - a.rating);
    const byReviews = [...all].sort((a, b) => b.reviewCount - a.reviewCount);

    return {
      categories,
      popularPicks: byReviews.slice(0, 10),
      topEvents: byRating.slice(0, 10),
      featuredEvents: all.filter((event) => event.isFeatured).slice(0, 10),
      trendingEvents: byReviews.slice(0, 10),
      recommendedEvents: all.slice(0, 10),
      banners: [] as unknown[],
    };
  }

  private async favouriteIds(userId?: string): Promise<Set<string>> {
    if (!userId) return new Set<string>();
    const rows = await this.prisma.savedItem.findMany({
      where: { userId, kind: SavedItemKind.EVENT },
      select: { targetId: true },
    });
    return new Set(rows.map((row) => row.targetId));
  }

  /**
   * Maps client-facing sort aliases onto the canonical sort keys handled by
   * {@link orderBy} (and the post-fetch price sort in {@link list}).
   */
  private normalizeSort(sort: string): string {
    switch (sort) {
      case 'date':
        return 'soonest';
      case 'popular':
        return 'rating';
      case 'recommended':
        return 'featured';
      default:
        return sort;
    }
  }

  private orderBy(sort: string): Prisma.EventOrderByWithRelationInput[] {
    switch (sort) {
      case 'rating':
        return [{ ratingAvg: 'desc' }, { id: 'asc' }];
      case 'newest':
        return [{ createdAt: 'desc' }, { id: 'asc' }];
      case 'featured':
        return [{ isFeatured: 'desc' }, { startAt: 'asc' }, { id: 'asc' }];
      case 'soonest':
      case 'distance':
      case 'priceAsc':
      case 'priceDesc':
      default:
        return [{ startAt: 'asc' }, { id: 'asc' }];
    }
  }

  private toCard(
    event: EventWithRelations,
    isFavorite: boolean,
    lat?: number,
    lng?: number,
  ): EventCardView {
    const eventLat = toNumber(event.latitude);
    const eventLng = toNumber(event.longitude);
    const distanceKm =
      lat !== undefined &&
      lng !== undefined &&
      eventLat !== null &&
      eventLng !== null
        ? Math.round(haversineKm(lat, lng, eventLat, eventLng) * 10) / 10
        : 0;

    const activeTickets = event.ticketTypes.filter(
      (tt) => tt.isActive && tt.deletedAt === null,
    );
    const prices = activeTickets.map((tt) => Number(tt.priceAmount));
    const priceFrom = prices.length > 0 ? Math.min(...prices) : 0;
    const currency = activeTickets[0]?.currency ?? 'KES';
    const image = event.coverImageUrl ?? event.bannerUrl;

    return {
      id: event.id,
      name: event.name,
      category: event.category?.name ?? null,
      categorySlug: event.category?.slug ?? null,
      venue: event.venue,
      city: event.city,
      image,
      bannerUrl: event.bannerUrl,
      coverImageUrl: event.coverImageUrl,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt ? event.endAt.toISOString() : null,
      rating: Number(event.ratingAvg),
      reviewCount: event.reviewCount,
      isFeatured: event.isFeatured,
      priceFrom,
      currency,
      isFree: priceFrom === 0,
      latitude: eventLat,
      longitude: eventLng,
      distanceKm,
      isFavorite,
      isFavourite: isFavorite,
      navigation: {
        route: event.navigationRoute ?? `/event/${event.id}`,
      },
    };
  }
}
