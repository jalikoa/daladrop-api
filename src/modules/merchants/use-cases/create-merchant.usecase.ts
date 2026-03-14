import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IMerchantRepository } from '../interfaces/merchant-repository.interface';
import { CreateMerchantDto } from '../dto/create-merchant.dto';
import { MerchantProfile } from '../entities/merchant-profile.entity';
import { MERCHANT_CONSTANTS } from '../constants/merchant.constants';

@Injectable()
export class CreateMerchantUseCase {
  constructor(
    @Inject('IMerchantRepository') private readonly merchantRepo: IMerchantRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(userId: number, dto: CreateMerchantDto): Promise<MerchantProfile> {
    const merchant = await this.merchantRepo.create(userId, dto);

    this.eventEmitter.emit(MERCHANT_CONSTANTS.EVENTS.CREATED, {
      merchantId: merchant.id,
      userId: merchant.user_id,
      businessName: merchant.business_name,
      timestamp: new Date(),
    });

    return merchant;
  }
}
