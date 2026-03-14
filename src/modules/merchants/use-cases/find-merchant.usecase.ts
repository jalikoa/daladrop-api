import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import type { IMerchantRepository } from '../interfaces/merchant-repository.interface';
import { MerchantProfile } from '../entities/merchant-profile.entity';

@Injectable()
export class FindMerchantUseCase {
  constructor(@Inject('IMerchantRepository') private readonly merchantRepo: IMerchantRepository) {}

  async byId(id: number): Promise<MerchantProfile> {
    const merchant = await this.merchantRepo.findById(id);
    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${id} not found`);
    }
    return merchant;
  }

  async byUserId(userId: number): Promise<MerchantProfile> {
    const merchant = await this.merchantRepo.findByUserId(userId);
    if (!merchant) {
      throw new NotFoundException(`Merchant profile not found for user ${userId}`);
    }
    return merchant;
  }

  async byPaybill(paybill: string): Promise<MerchantProfile> {
    const merchant = await this.merchantRepo.findByPaybill(paybill);
    if (!merchant) {
      throw new NotFoundException(`Merchant with paybill ${paybill} not found`);
    }
    return merchant;
  }
}
