import { Injectable, BadRequestException, NotFoundException, Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IMerchantRepository } from '../../merchants/interfaces/merchant-repository.interface';
import { DecodedTokenResponseDto } from '../dto/nfc-tag-response.dto';
import { NFC_CONSTANTS } from '../constants/nfc.constants';
import { v4 as uuidv4 } from 'uuid';

export interface DecodeTokenInput {
  muid: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class DecodeTokenUseCase {
  private readonly logger = new Logger(DecodeTokenUseCase.name);

  constructor(
    @Inject('IMerchantRepository') private readonly merchantRepo: IMerchantRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: DecodeTokenInput): Promise<DecodedTokenResponseDto> {
    try {
      // Validate muid is a valid UUID format
      if (!input.muid || typeof input.muid !== 'string') {
        this.logger.warn(`Invalid muid format: ${input.muid}`);
        throw new BadRequestException('Invalid or corrupted merchant uid');
      }

      const merchant = await this.merchantRepo.findByUid(input.muid);
      if (!merchant || !merchant.isActive()) {
        throw new NotFoundException('Merchant not found or inactive');
      }

      const sessionUuid = uuidv4();

      this.eventEmitter.emit(NFC_CONSTANTS.EVENTS.PAYMENT_SESSION_STARTED, {
        sessionUuid,
        merchantId: merchant.id,
        userId: merchant.user_id,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        timestamp: new Date(),
      });

      return {
        success: true,
        data: {
          muid: merchant.uid,
          merchant_id: merchant.id,
          merchant_name: merchant.business_name,
          paybill_number: merchant.paybill_number,
          merchant_logo: merchant.logo_url,
          session_uuid: sessionUuid,
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // Token expires in 15 minutes
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Token decryption failed: ${error.message}`, error.stack);
      throw new BadRequestException('Invalid or corrupted merchant uid');
    }
  }
}
