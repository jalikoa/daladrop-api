import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MerchantKycStatus,
  MerchantStatus,
  Prisma,
  type MerchantKyc,
} from '@prisma/client';
import { PaginationService } from '../../../platform/api/pagination/pagination.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PrismaOutboxWriter } from '../../../infrastructure/database/outbox/prisma-outbox.writer';
import type {
  ReviewMerchantKycDto,
  SubmitMerchantKycDto,
} from '../dto/merchants.dto';

@Injectable()
export class MerchantKycService {
  private readonly pagination = new PaginationService(20, 100);
  private readonly outbox: PrismaOutboxWriter;

  public constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {
    this.outbox = new PrismaOutboxWriter(this.prisma);
  }

  public async get(merchantId: string): Promise<{
    success: true;
    kyc: MerchantKyc | null;
  }> {
    await this.requireMerchant(merchantId);
    const kyc = await this.prisma.merchantKyc.findUnique({
      where: { merchantId },
    });
    return { success: true, kyc };
  }

  public async upsertDraft(
    merchantId: string,
    input: SubmitMerchantKycDto,
  ): Promise<{ success: true; kyc: MerchantKyc }> {
    await this.requireMerchant(merchantId);
    const existing = await this.prisma.merchantKyc.findUnique({
      where: { merchantId },
    });
    if (
      existing &&
      (existing.status === MerchantKycStatus.PENDING ||
        existing.status === MerchantKycStatus.APPROVED)
    ) {
      throw new BadRequestException(
        `Cannot edit KYC while status is ${existing.status}`,
      );
    }

    const data = this.draftData(input);
    const kyc = await this.prisma.merchantKyc.upsert({
      where: { merchantId },
      create: {
        merchantId,
        status: MerchantKycStatus.NOT_STARTED,
        ...data,
      },
      update: {
        ...data,
        status: MerchantKycStatus.NOT_STARTED,
        submittedAt: null,
        reviewedAt: null,
        reviewedBy: null,
        reviewNotes: null,
        rejectionReason: null,
        version: { increment: 1 },
      },
    });
    return { success: true, kyc };
  }

  public async submit(
    merchantId: string,
    input: SubmitMerchantKycDto = {},
  ): Promise<{ success: true; kyc: MerchantKyc }> {
    await this.requireMerchant(merchantId);
    const existing = await this.prisma.merchantKyc.findUnique({
      where: { merchantId },
    });
    if (existing?.status === MerchantKycStatus.PENDING) {
      throw new BadRequestException('KYC already submitted and pending review');
    }
    if (existing?.status === MerchantKycStatus.APPROVED) {
      throw new BadRequestException('KYC already approved');
    }

    const data = this.draftData(input);
    const now = new Date();
    const kyc = await this.prisma.merchantKyc.upsert({
      where: { merchantId },
      create: {
        merchantId,
        status: MerchantKycStatus.PENDING,
        submittedAt: now,
        ...data,
      },
      update: {
        ...data,
        status: MerchantKycStatus.PENDING,
        submittedAt: now,
        reviewedAt: null,
        reviewedBy: null,
        reviewNotes: null,
        rejectionReason: null,
        version: { increment: 1 },
      },
    });
    return { success: true, kyc };
  }

  public async review(
    merchantId: string,
    input: ReviewMerchantKycDto,
    reviewedBy: string,
  ): Promise<{ success: true; kyc: MerchantKyc }> {
    await this.requireMerchant(merchantId);
    const existing = await this.prisma.merchantKyc.findUnique({
      where: { merchantId },
    });
    if (!existing) {
      throw new NotFoundException('KYC record not found');
    }
    if (existing.status !== MerchantKycStatus.PENDING) {
      throw new BadRequestException('Only pending KYC can be reviewed');
    }

    const now = new Date();
    const status =
      input.decision === 'APPROVED'
        ? MerchantKycStatus.APPROVED
        : MerchantKycStatus.REJECTED;

    if (status === MerchantKycStatus.REJECTED && !input.rejectionReason?.trim()) {
      throw new BadRequestException('rejectionReason is required when rejecting');
    }

    const kyc = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.merchantKyc.update({
        where: { merchantId },
        data: {
          status,
          reviewedAt: now,
          reviewedBy,
          reviewNotes: input.reviewNotes?.trim() || null,
          rejectionReason:
            status === MerchantKycStatus.REJECTED
              ? input.rejectionReason!.trim()
              : null,
          version: { increment: 1 },
        },
      });

      if (status === MerchantKycStatus.APPROVED) {
        const merchant = await tx.merchant.findFirst({
          where: { id: merchantId, deletedAt: null },
        });
        if (merchant?.status === MerchantStatus.DRAFT) {
          await tx.merchant.update({
            where: { id: merchantId },
            data: {
              status: MerchantStatus.ACTIVE,
              updatedBy: reviewedBy,
              version: { increment: 1 },
            },
          });
        }
      }

      return updated;
    });

    if (status === MerchantKycStatus.APPROVED) {
      this.events.emit('merchants.MerchantApproved', {
        merchantId,
        reviewedBy,
        kycId: kyc.id,
      });
      this.events.emit('merchants.merchant.updated', {
        merchantId,
        actorId: reviewedBy,
      });
      try {
        await this.outbox.append({
          eventId: `MerchantApproved-${merchantId}-${Date.now()}`,
          aggregateId: merchantId,
          eventName: 'MerchantApproved',
          payload: { merchantId, reviewedBy, kycId: kyc.id },
        });
      } catch {
        /* best-effort */
      }
    }

    return { success: true, kyc };
  }

  public async listPending(input: {
    readonly page?: string | number;
    readonly limit?: string | number;
  }): Promise<{
    success: true;
    items: (MerchantKyc & {
      merchant: { id: string; name: string; status: MerchantStatus };
    })[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  }> {
    const { page, limit } = this.pagination.normalizeOffset({
      page: input.page !== undefined ? Number(input.page) : undefined,
      limit: input.limit !== undefined ? Number(input.limit) : undefined,
    });

    const where: Prisma.MerchantKycWhereInput = {
      status: MerchantKycStatus.PENDING,
      merchant: { deletedAt: null },
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.merchantKyc.count({ where }),
      this.prisma.merchantKyc.findMany({
        where,
        include: {
          merchant: {
            select: { id: true, name: true, status: true },
          },
        },
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      success: true,
      items,
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  private draftData(input: SubmitMerchantKycDto): {
    businessRegistrationNumber?: string | null;
    taxPin?: string | null;
    directorIdNumber?: string | null;
    businessAddress?: string | null;
    documentUrls?: string[];
  } {
    return {
      ...(input.businessRegistrationNumber !== undefined
        ? {
            businessRegistrationNumber:
              input.businessRegistrationNumber?.trim() || null,
          }
        : {}),
      ...(input.taxPin !== undefined
        ? { taxPin: input.taxPin?.trim() || null }
        : {}),
      ...(input.directorIdNumber !== undefined
        ? { directorIdNumber: input.directorIdNumber?.trim() || null }
        : {}),
      ...(input.businessAddress !== undefined
        ? { businessAddress: input.businessAddress?.trim() || null }
        : {}),
      ...(input.documentUrls !== undefined
        ? { documentUrls: input.documentUrls }
        : {}),
    };
  }

  private async requireMerchant(merchantId: string): Promise<void> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id: merchantId, deletedAt: null },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
  }
}
