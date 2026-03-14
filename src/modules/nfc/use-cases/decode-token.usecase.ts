import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IMerchantRepository } from '../../merchants/interfaces/merchant-repository.interface';
import { EncryptionService } from '../../../common/security/encryption.service';
import { DecodedTokenResponseDto } from '../dto/nfc-tag-response.dto';
import { NFC_CONSTANTS } from '../constants/nfc.constants';
import { v4 as uuidv4 } from 'uuid';

export interface DecodeTokenInput {
  encryptedToken: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class DecodeTokenUseCase {
  constructor(
    private readonly merchantRepo: IMerchantRepository,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: DecodeTokenInput): Promise<DecodedTokenResponseDto> {
    try {
      const decrypted = this.encryptionService.decryptPayload(input.encryptedToken);
      const payload = JSON.parse(decrypted);

      if (!payload.mid || !payload.issuedAt) {
        throw new BadRequestException('Invalid token payload');
      }

      if (payload.expiresAt && new Date(payload.expiresAt) < new Date()) {
        throw new BadRequestException('Token has expired');
      }

      const merchant = await this.merchantRepo.findById(payload.mid);
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
          merchant_id: merchant.id,
          merchant_name: merchant.business_name,
          merchant_logo: merchant.logo_url,
          session_uuid: sessionUuid,
          expires_at: payload.expiresAt,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error('Token decryption failed:', error);
      throw new BadRequestException('Invalid or corrupted payment token');
    }
  }
}
