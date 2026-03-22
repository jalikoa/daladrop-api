import { Injectable, Inject,NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { INfcRepository } from '../interfaces/nfc-repository.interface';
import type { IMerchantRepository } from '../../merchants/interfaces/merchant-repository.interface';
import { EncryptionService } from '../../../common/security/encryption.service';
import { CreateNfcTagDto } from '../dto/create-nfc-tag.dto';
import { NfcTag } from '../entities/nfc-tag.entity';
import { NFC_CONSTANTS } from '../constants/nfc.constants';

@Injectable()
export class CreateNfcTagUseCase {
  constructor(
    @Inject('INfcRepository') private readonly nfcRepo: INfcRepository,
    @Inject('IMerchantRepository') private readonly merchantRepo: IMerchantRepository,
    private readonly encryptionService: EncryptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(merchantId: number, dto: CreateNfcTagDto): Promise<NfcTag> {
    const merchant = await this.merchantRepo.findById(merchantId);
    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${merchantId} not found`);
    }
    if (!merchant.isActive()) {
      throw new UnprocessableEntityException(
        `Cannot create NFC tag: merchant "${merchant.business_name}" is not active or verified`,
      );
    }

    const tagCount = await this.nfcRepo.countByMerchant(merchantId);
    if (tagCount >= NFC_CONSTANTS.MAX_TAGS_PER_MERCHANT) {
      throw new UnprocessableEntityException(
        `Merchant has reached the maximum of ${NFC_CONSTANTS.MAX_TAGS_PER_MERCHANT} NFC tags`,
      );
    }

    // const payload = {
    //   mid: merchantId,
    //   uid: merchant.user_id,
    //   issuedAt: new Date().toISOString(),
    // };
    // const encryptedPayload = this.encryptionService.encryptPayload(JSON.stringify(payload));

    const tag = await (this.nfcRepo as any).create(merchantId, {
      ...dto,
      encrypted_payload: merchantId,
    });

    this.eventEmitter.emit(NFC_CONSTANTS.EVENTS.TAG_CREATED, {
      tagId: tag.id,
      merchantId,
      // encryptedPayload: encryptedPayload.substring(0, 30) + '...', --- IGNORE ---
      timestamp: new Date(),
    });

    return tag;
  }
}
