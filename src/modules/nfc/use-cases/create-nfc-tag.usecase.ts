import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { INfcRepository } from '../interfaces/nfc-repository.interface';
import { IMerchantRepository } from '../../merchants/interfaces/merchant-repository.interface';
import { EncryptionService } from '../../../common/security/encryption.service';
import { CreateNfcTagDto } from '../dto/create-nfc-tag.dto';
import { NfcTag } from '../entities/nfc-tag.entity';
import { NFC_CONSTANTS } from '../constants/nfc.constants';

@Injectable()
export class CreateNfcTagUseCase {
  constructor(
    private readonly nfcRepo: INfcRepository,
    private readonly merchantRepo: IMerchantRepository,
    private readonly encryptionService: EncryptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(merchantId: number, dto: CreateNfcTagDto): Promise<NfcTag> {
    const merchant = await this.merchantRepo.findById(merchantId);
    if (!merchant || !merchant.isActive()) {
      throw new Error('Cannot create NFC tag for inactive merchant');
    }

    const tagCount = await this.nfcRepo.countByMerchant(merchantId);
    if (tagCount >= NFC_CONSTANTS.MAX_TAGS_PER_MERCHANT) {
      throw new Error(`Maximum ${NFC_CONSTANTS.MAX_TAGS_PER_MERCHANT} tags per merchant`);
    }

    const payload = {
      mid: merchantId,
      uid: merchant.user_id,
      issuedAt: new Date().toISOString(),
    };
    const encryptedPayload = this.encryptionService.encryptPayload(JSON.stringify(payload));

    const tag = await (this.nfcRepo as any).create(merchantId, {
      ...dto,
      encrypted_payload: encryptedPayload,
    });

    this.eventEmitter.emit(NFC_CONSTANTS.EVENTS.TAG_CREATED, {
      tagId: tag.id,
      merchantId,
      encryptedPayload: encryptedPayload.substring(0, 30) + '...',
      timestamp: new Date(),
    });

    return tag;
  }
}
