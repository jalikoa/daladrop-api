import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditAction,
  MerchantStatus,
  Prisma,
  type Merchant,
  type MerchantKyc,
} from '@prisma/client';
import { PaginationService } from '../../../platform/api/pagination/pagination.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';
import type {
  CreateMerchantDto,
  UpdateMerchantDto,
} from '../dto/merchants.dto';

export interface AdminMerchantListItem {
  readonly id: string;
  readonly ownerUserId: string;
  readonly name: string;
  readonly legalName: string | null;
  readonly status: MerchantStatus;
  readonly taxId: string | null;
  readonly featured: boolean;
  readonly isOrganizer: boolean;
  readonly storeCount: number;
  readonly kycStatus: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@Injectable()
export class AdminMerchantsService {
  private readonly pagination = new PaginationService(20, 100);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: EventEmitter2,
  ) {}

  public async list(input: {
    readonly q?: string;
    readonly status?: string;
    readonly page?: string | number;
    readonly limit?: string | number;
  }): Promise<{
    success: true;
    items: AdminMerchantListItem[];
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
    const statusRaw = input.status?.trim();
    const status =
      statusRaw &&
      Object.values(MerchantStatus).includes(statusRaw as MerchantStatus)
        ? (statusRaw as MerchantStatus)
        : undefined;

    const where: Prisma.MerchantWhereInput = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { legalName: { contains: q, mode: 'insensitive' } },
              { taxId: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.merchant.count({ where }),
      this.prisma.merchant.findMany({
        where,
        include: {
          kyc: { select: { status: true } },
          _count: {
            select: { stores: { where: { deletedAt: null } } },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const items = rows.map((row) => this.toListItem(row));
    return {
      success: true,
      items,
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  public async get(id: string): Promise<{
    success: true;
    merchant: AdminMerchantListItem & {
      deletedAt: Date | null;
      kyc: MerchantKyc | null;
    };
  }> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id, deletedAt: null },
      include: {
        kyc: true,
        _count: {
          select: { stores: { where: { deletedAt: null } } },
        },
      },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return {
      success: true,
      merchant: {
        ...this.toListItem(merchant),
        deletedAt: merchant.deletedAt,
        kyc: merchant.kyc,
      },
    };
  }

  public async create(
    input: CreateMerchantDto,
    actorId?: string,
  ): Promise<{ success: true; merchant: Merchant }> {
    const merchant = await this.prisma.merchant.create({
      data: {
        ownerUserId: input.ownerUserId,
        name: input.name.trim(),
        legalName: input.legalName?.trim() || null,
        taxId: input.taxId?.trim() || null,
        featured: input.featured ?? false,
        isOrganizer: input.isOrganizer ?? false,
        status: input.status ?? MerchantStatus.DRAFT,
        createdBy: actorId ?? null,
        updatedBy: actorId ?? null,
      },
    });
    await this.audit.record({
      tableName: 'merchants',
      recordId: merchant.id,
      action: AuditAction.INSERT,
      actorId,
      afterData: merchant,
      reason: 'Admin merchant create',
    });
    this.events.emit('merchants.merchant.created', {
      merchantId: merchant.id,
      actorId,
    });
    return { success: true, merchant };
  }

  public async update(
    id: string,
    input: UpdateMerchantDto,
    actorId?: string,
  ): Promise<{ success: true; merchant: Merchant }> {
    await this.requireActive(id);
    const merchant = await this.prisma.merchant.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.legalName !== undefined
          ? { legalName: input.legalName?.trim() || null }
          : {}),
        ...(input.taxId !== undefined
          ? { taxId: input.taxId?.trim() || null }
          : {}),
        ...(input.featured !== undefined ? { featured: input.featured } : {}),
        ...(input.isOrganizer !== undefined
          ? { isOrganizer: input.isOrganizer }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedBy: actorId ?? null,
        version: { increment: 1 },
      },
    });
    await this.audit.record({
      tableName: 'merchants',
      recordId: merchant.id,
      action: AuditAction.UPDATE,
      actorId,
      afterData: merchant,
      reason: 'Admin merchant update',
    });
    this.events.emit('merchants.merchant.updated', {
      merchantId: merchant.id,
      actorId,
    });
    return { success: true, merchant };
  }

  public async softDelete(
    id: string,
    actorId?: string,
    reason?: string,
  ): Promise<{ success: true }> {
    await this.requireActive(id);
    await this.prisma.merchant.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: actorId ?? null,
        deleteReason: reason?.trim() || null,
        status: MerchantStatus.CLOSED,
        updatedBy: actorId ?? null,
        version: { increment: 1 },
      },
    });
    await this.audit.record({
      tableName: 'merchants',
      recordId: id,
      action: AuditAction.SOFT_DELETE,
      actorId,
      reason: reason?.trim() || 'Admin merchant soft-delete',
    });
    this.events.emit('merchants.merchant.deleted', { merchantId: id, actorId });
    return { success: true };
  }

  private async requireActive(id: string): Promise<Merchant> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id, deletedAt: null },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return merchant;
  }

  private toListItem(
    row: Merchant & {
      kyc?: { status: string } | null;
      _count: { stores: number };
    },
  ): AdminMerchantListItem {
    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      name: row.name,
      legalName: row.legalName,
      status: row.status,
      taxId: row.taxId,
      featured: row.featured,
      isOrganizer: row.isOrganizer,
      storeCount: row._count.stores,
      kycStatus: row.kyc?.status ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
