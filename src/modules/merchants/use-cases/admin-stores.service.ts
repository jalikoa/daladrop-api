import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditAction,
  Prisma,
  StoreType,
  type Store,
  type StoreOpeningHour,
} from '@prisma/client';
import { PaginationService } from '../../../platform/api/pagination/pagination.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';
import type {
  CreateStoreDto,
  OpeningHourItemDto,
  UpdateStoreDto,
} from '../dto/merchants.dto';

function jsonSafeStore<T extends Store>(store: T) {
  return {
    ...store,
    deliveryFeeHint:
      store.deliveryFeeHint === null || store.deliveryFeeHint === undefined
        ? null
        : Number(store.deliveryFeeHint),
    minimumOrderAmount:
      store.minimumOrderAmount === null ||
      store.minimumOrderAmount === undefined
        ? null
        : Number(store.minimumOrderAmount),
    latitude:
      store.latitude === null || store.latitude === undefined
        ? null
        : Number(store.latitude),
    longitude:
      store.longitude === null || store.longitude === undefined
        ? null
        : Number(store.longitude),
    ratingAvg: Number(store.ratingAvg),
  };
}

const NAV_BY_TYPE: Partial<Record<StoreType, string>> = {
  [StoreType.RESTAURANT]: '/restaurant',
  [StoreType.MARKET]: '/local-markets',
  [StoreType.LIQUOR]: '/liquor-store',
  [StoreType.GAS]: '/gas-store',
};

@Injectable()
export class AdminStoresService {
  private readonly pagination = new PaginationService(20, 100);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: EventEmitter2,
  ) {}

  public async list(input: {
    readonly q?: string;
    readonly merchantId?: string;
    readonly storeType?: string;
    readonly page?: string | number;
    readonly limit?: string | number;
  }): Promise<{
    success: true;
    items: Store[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  }> {
    const { page, limit } = this.pagination.normalizeOffset({
      page: input.page !== undefined ? Number(input.page) : undefined,
      limit: input.limit !== undefined ? Number(input.limit) : undefined,
    });
    const q = input.q?.trim();
    const merchantId = input.merchantId?.trim();
    const storeTypeRaw = input.storeType?.trim();
    const storeType =
      storeTypeRaw &&
      Object.values(StoreType).includes(storeTypeRaw as StoreType)
        ? (storeTypeRaw as StoreType)
        : undefined;

    const where: Prisma.StoreWhereInput = {
      deletedAt: null,
      ...(merchantId ? { merchantId } : {}),
      ...(storeType ? { storeType } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } },
              { address: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.store.count({ where }),
      this.prisma.store.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      success: true,
      items: items.map((item) => jsonSafeStore(item)),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  public async get(id: string): Promise<{
    success: true;
    store: ReturnType<typeof jsonSafeStore> & {
      openingHours: StoreOpeningHour[];
    };
  }> {
    const store = await this.prisma.store.findFirst({
      where: { id, deletedAt: null },
      include: {
        openingHours: { orderBy: { day: 'asc' } },
      },
    });
    if (!store) throw new NotFoundException('Store not found');
    return {
      success: true,
      store: { ...jsonSafeStore(store), openingHours: store.openingHours },
    };
  }

  public async create(
    input: CreateStoreDto,
    actorId?: string,
  ): Promise<{ success: true; store: ReturnType<typeof jsonSafeStore> }> {
    await this.requireMerchant(input.merchantId);

    const created = await this.prisma.store.create({
      data: {
        merchantId: input.merchantId,
        storeType: input.storeType,
        name: input.name.trim(),
        slug: input.slug?.trim() || null,
        description: input.description?.trim() || null,
        city: input.city?.trim() || null,
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
        whatsapp: input.whatsapp?.trim() || null,
        email: input.email?.trim() || null,
        website: input.website?.trim() || null,
        imageUrl: input.imageUrl?.trim() || null,
        coverImageUrl: input.coverImageUrl?.trim() || null,
        latitude:
          input.latitude !== undefined ? input.latitude : undefined,
        longitude:
          input.longitude !== undefined ? input.longitude : undefined,
        deliveryFeeHint:
          input.deliveryFeeHint !== undefined
            ? BigInt(input.deliveryFeeHint)
            : undefined,
        minimumOrderAmount:
          input.minimumOrderAmount !== undefined
            ? BigInt(input.minimumOrderAmount)
            : undefined,
        deliveryTimeMin: input.deliveryTimeMin,
        deliveryTimeMax: input.deliveryTimeMax,
        isOpen: input.isOpen ?? false,
        isActive: input.isActive ?? true,
        ageRestricted: input.ageRestricted ?? false,
        tags: input.tags ?? [],
        createdBy: actorId ?? null,
        updatedBy: actorId ?? null,
      },
    });

    const navPrefix = NAV_BY_TYPE[created.storeType];
    const store =
      navPrefix && !created.navigationRoute
        ? await this.prisma.store.update({
            where: { id: created.id },
            data: {
              navigationRoute: `${navPrefix}/${created.id}`,
              updatedBy: actorId ?? null,
            },
          })
        : created;

    const safe = jsonSafeStore(store);
    await this.audit.record({
      tableName: 'stores',
      recordId: store.id,
      action: AuditAction.INSERT,
      actorId,
      afterData: safe,
      reason: 'Admin store create',
    });
    this.events.emit('merchants.store.created', {
      storeId: store.id,
      storeType: store.storeType,
      merchantId: store.merchantId,
      actorId,
    });
    return { success: true, store: safe };
  }

  public async update(
    id: string,
    input: UpdateStoreDto,
    actorId?: string,
  ): Promise<{ success: true; store: ReturnType<typeof jsonSafeStore> }> {
    await this.requireStore(id);
    const store = await this.prisma.store.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.slug !== undefined
          ? { slug: input.slug?.trim() || null }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.city !== undefined
          ? { city: input.city?.trim() || null }
          : {}),
        ...(input.address !== undefined
          ? { address: input.address?.trim() || null }
          : {}),
        ...(input.phone !== undefined
          ? { phone: input.phone?.trim() || null }
          : {}),
        ...(input.whatsapp !== undefined
          ? { whatsapp: input.whatsapp?.trim() || null }
          : {}),
        ...(input.email !== undefined
          ? { email: input.email?.trim() || null }
          : {}),
        ...(input.website !== undefined
          ? { website: input.website?.trim() || null }
          : {}),
        ...(input.imageUrl !== undefined
          ? { imageUrl: input.imageUrl?.trim() || null }
          : {}),
        ...(input.coverImageUrl !== undefined
          ? { coverImageUrl: input.coverImageUrl?.trim() || null }
          : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined
          ? { longitude: input.longitude }
          : {}),
        ...(input.deliveryFeeHint !== undefined
          ? { deliveryFeeHint: BigInt(input.deliveryFeeHint) }
          : {}),
        ...(input.minimumOrderAmount !== undefined
          ? { minimumOrderAmount: BigInt(input.minimumOrderAmount) }
          : {}),
        ...(input.deliveryTimeMin !== undefined
          ? { deliveryTimeMin: input.deliveryTimeMin }
          : {}),
        ...(input.deliveryTimeMax !== undefined
          ? { deliveryTimeMax: input.deliveryTimeMax }
          : {}),
        ...(input.isOpen !== undefined ? { isOpen: input.isOpen } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.ageRestricted !== undefined
          ? { ageRestricted: input.ageRestricted }
          : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.storeType !== undefined
          ? { storeType: input.storeType }
          : {}),
        updatedBy: actorId ?? null,
        version: { increment: 1 },
      },
    });
    const safe = jsonSafeStore(store);
    await this.audit.record({
      tableName: 'stores',
      recordId: store.id,
      action: AuditAction.UPDATE,
      actorId,
      afterData: safe,
      reason: 'Admin store update',
    });
    this.events.emit('merchants.store.updated', {
      storeId: store.id,
      storeType: store.storeType,
      actorId,
    });
    return { success: true, store: safe };
  }

  public async softDelete(
    id: string,
    actorId?: string,
    reason?: string,
  ): Promise<{ success: true }> {
    await this.requireStore(id);
    await this.prisma.store.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: actorId ?? null,
        deleteReason: reason?.trim() || null,
        isActive: false,
        updatedBy: actorId ?? null,
        version: { increment: 1 },
      },
    });
    await this.audit.record({
      tableName: 'stores',
      recordId: id,
      action: AuditAction.SOFT_DELETE,
      actorId,
      reason: reason?.trim() || 'Admin store soft-delete',
    });
    this.events.emit('merchants.store.deleted', { storeId: id, actorId });
    return { success: true };
  }

  public async replaceOpeningHours(
    storeId: string,
    hours: OpeningHourItemDto[],
  ): Promise<{
    success: true;
    openingHours: StoreOpeningHour[];
  }> {
    await this.requireStore(storeId);

    const days = hours.map((h) => h.day);
    if (new Set(days).size !== days.length) {
      throw new BadRequestException('Duplicate opening-hour days');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.storeOpeningHour.deleteMany({ where: { storeId } });
      if (hours.length === 0) return;
      await tx.storeOpeningHour.createMany({
        data: hours.map((hour) => ({
          storeId,
          day: hour.day,
          openTime: hour.isClosed ? null : hour.openTime?.trim() || null,
          closeTime: hour.isClosed ? null : hour.closeTime?.trim() || null,
          isClosed: hour.isClosed ?? false,
        })),
      });
    });

    const openingHours = await this.prisma.storeOpeningHour.findMany({
      where: { storeId },
      orderBy: { day: 'asc' },
    });
    return { success: true, openingHours };
  }

  private async requireMerchant(merchantId: string): Promise<void> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id: merchantId, deletedAt: null },
      select: { id: true },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
  }

  private async requireStore(id: string): Promise<Store> {
    const store = await this.prisma.store.findFirst({
      where: { id, deletedAt: null },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }
}
