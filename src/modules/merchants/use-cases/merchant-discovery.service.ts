import { Injectable } from '@nestjs/common';
import { MerchantStatus, StoreType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  VerticalStoreDiscoveryService,
  type VerticalListQuery,
} from './vertical-store-discovery.service';

const DISCOVERABLE_STORE_TYPES: readonly StoreType[] = [
  StoreType.RESTAURANT,
  StoreType.MARKET,
  StoreType.LIQUOR,
  StoreType.GAS,
];

const CATEGORY_LABEL: Record<StoreType, string> = {
  RESTAURANT: 'Restaurants',
  MARKET: 'Local Markets',
  LIQUOR: 'Liquor Stores',
  GAS: 'Gas Delivery',
  GENERAL: 'General',
  EVENT: 'Events',
};

/**
 * Public merchant discovery across all commerce verticals — the "browse all
 * merchants" surface, as distinct from the per-vertical discovery consumed
 * by `restaurants` / `local-markets` / `liquor-stores` / `gas-delivery`.
 */
@Injectable()
export class MerchantDiscoveryService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: VerticalStoreDiscoveryService,
  ) {}

  public async list(query: VerticalListQuery, userId?: string) {
    const storeTypes = this.resolveStoreTypes(query.serviceType);
    const result = await this.discovery.listAcrossTypes(
      storeTypes,
      query,
      userId,
    );
    return {
      success: true as const,
      merchants: result.items,
      items: result.items,
      page: result.page,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  public async feed(query: VerticalListQuery, userId?: string) {
    const storeTypes = this.resolveStoreTypes(query.serviceType);
    const [result, categories] = await Promise.all([
      this.discovery.listAcrossTypes(
        storeTypes,
        { ...query, page: '1', limit: query.limit ?? query.pageSize ?? '20' },
        userId,
      ),
      this.categoryCounts(storeTypes),
    ]);
    return {
      success: true as const,
      merchants: result.items,
      items: result.items,
      categories,
      featured: result.items.filter((item) => item.rating >= 4.5).slice(0, 10),
      recommended: result.items.slice(0, 10),
      page: result.page,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  public async featured(query: VerticalListQuery, userId?: string) {
    const feed = await this.feed(
      { ...query, featured: 'true', page: '1' },
      userId,
    );
    return {
      success: true as const,
      merchants: feed.featured,
      items: feed.featured,
      page: 1,
      hasMore: false,
      total: feed.featured.length,
    };
  }

  public async near(query: VerticalListQuery, userId?: string) {
    return this.list(
      { ...query, sort: query.sort ?? 'distance' },
      userId,
    );
  }

  public async categories() {
    const categories = await this.categoryCounts(DISCOVERABLE_STORE_TYPES);
    return { success: true as const, categories };
  }

  public async getById(id: string, userId?: string) {
    const merchant = await this.prisma.merchant.findFirst({
      where: {
        id,
        deletedAt: null,
        status: MerchantStatus.ACTIVE,
      },
      include: {
        stores: {
          where: { deletedAt: null, isActive: true },
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!merchant) {
      // Fallback: treat id as a store id for clients that pass store UUID.
      const store = await this.prisma.store.findFirst({
        where: {
          id,
          deletedAt: null,
          isActive: true,
          merchant: { deletedAt: null, status: MerchantStatus.ACTIVE },
        },
        include: { merchant: true },
      });
      if (!store) return null;
      const listed = await this.discovery.listAcrossTypes(
        [store.storeType],
        { page: '1', limit: '1', search: store.name },
        userId,
      );
      return listed.items.find((item) => item.id === store.id) ?? {
        id: store.id,
        name: store.name,
        storeType: store.storeType,
        merchantId: store.merchantId,
        merchantName: store.merchant.name,
      };
    }
    return {
      id: merchant.id,
      name: merchant.name,
      status: merchant.status,
      stores: merchant.stores.map((store) => ({
        id: store.id,
        name: store.name,
        storeType: store.storeType,
        isOpen: store.isOpen,
        city: store.city,
        imageUrl: store.imageUrl,
      })),
    };
  }

  private resolveStoreTypes(serviceType?: string): readonly StoreType[] {
    const requested = (serviceType ?? '').trim().toUpperCase();
    const match = DISCOVERABLE_STORE_TYPES.find((type) => type === requested);
    return match ? [match] : DISCOVERABLE_STORE_TYPES;
  }

  private async categoryCounts(storeTypes: readonly StoreType[]) {
    const counts = await Promise.all(
      storeTypes.map((storeType) =>
        this.prisma.store.count({
          where: {
            storeType,
            deletedAt: null,
            isActive: true,
            merchant: { deletedAt: null, status: MerchantStatus.ACTIVE },
          },
        }),
      ),
    );
    return storeTypes.map((storeType, index) => ({
      value: storeType.toLowerCase(),
      label: CATEGORY_LABEL[storeType],
      slug: storeType.toLowerCase(),
      count: counts[index],
    }));
  }
}
