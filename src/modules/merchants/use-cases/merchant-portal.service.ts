import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type {
  ReplaceOpeningHoursDto,
  SubmitMerchantKycDto,
  UpdateStoreDto,
} from '../dto/merchants.dto';
import { AdminStoresService } from './admin-stores.service';
import { MerchantKycService } from './merchant-kyc.service';

/**
 * Ownership-secured merchant self-service over stores + KYC.
 * Delegates mutations to admin services after verifying `ownerUserId`.
 */
@Injectable()
export class MerchantPortalService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly stores: AdminStoresService,
    private readonly kyc: MerchantKycService,
  ) {}

  public async listStores(ownerUserId: string) {
    const merchant = await this.requireOwnedMerchant(ownerUserId);
    return this.stores.list({ merchantId: merchant.id, page: 1, limit: 100 });
  }

  public async getStore(ownerUserId: string, storeId: string) {
    await this.requireOwnedStore(ownerUserId, storeId);
    return this.stores.get(storeId);
  }

  public async updateStore(
    ownerUserId: string,
    storeId: string,
    body: UpdateStoreDto,
  ) {
    await this.requireOwnedStore(ownerUserId, storeId);
    return this.stores.update(storeId, body, ownerUserId);
  }

  public async replaceOpeningHours(
    ownerUserId: string,
    storeId: string,
    body: ReplaceOpeningHoursDto,
  ) {
    await this.requireOwnedStore(ownerUserId, storeId);
    return this.stores.replaceOpeningHours(storeId, body.hours);
  }

  public async getKyc(ownerUserId: string) {
    const merchant = await this.requireOwnedMerchant(ownerUserId);
    return this.kyc.get(merchant.id);
  }

  public async upsertKyc(ownerUserId: string, body: SubmitMerchantKycDto) {
    const merchant = await this.requireOwnedMerchant(ownerUserId);
    return this.kyc.upsertDraft(merchant.id, body);
  }

  public async submitKyc(ownerUserId: string, body: SubmitMerchantKycDto = {}) {
    const merchant = await this.requireOwnedMerchant(ownerUserId);
    return this.kyc.submit(merchant.id, body);
  }

  private async requireOwnedMerchant(ownerUserId: string) {
    const merchant = await this.prisma.merchant.findFirst({
      where: { ownerUserId, deletedAt: null },
      select: { id: true, name: true, status: true },
    });
    if (!merchant) {
      throw new NotFoundException('No merchant profile for this user');
    }
    return merchant;
  }

  private async requireOwnedStore(ownerUserId: string, storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        deletedAt: null,
        merchant: { ownerUserId, deletedAt: null },
      },
      select: { id: true },
    });
    if (!store) {
      throw new ForbiddenException('Store is not owned by this merchant');
    }
    return store;
  }
}
