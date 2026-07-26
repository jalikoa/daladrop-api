import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';

/**
 * Read-side self-service lookups keyed by owner user id — powers the seller
 * onboarding probe (`/stores/check/:userId`) and `/user/:userId/merchants`.
 */
@Injectable()
export class MerchantSelfService {
  public constructor(private readonly prisma: PrismaService) {}

  public async checkStores(userId: string) {
    const merchant = await this.prisma.merchant.findFirst({
      where: { ownerUserId: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        stores: {
          where: { deletedAt: null },
          select: { id: true, name: true, storeType: true, isActive: true },
        },
      },
    });
    if (!merchant) {
      return {
        success: true as const,
        hasStore: false,
        exists: false,
        stores: [],
      };
    }
    return {
      success: true as const,
      hasStore: merchant.stores.length > 0,
      exists: true,
      merchantId: merchant.id,
      merchantStatus: merchant.status,
      stores: merchant.stores,
    };
  }

  public async listOwnedMerchants(userId: string) {
    const merchants = await this.prisma.merchant.findMany({
      where: { ownerUserId: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        featured: true,
        createdAt: true,
        stores: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            storeType: true,
            isActive: true,
            isOpen: true,
            city: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true as const,
      merchants,
      total: merchants.length,
    };
  }
}
