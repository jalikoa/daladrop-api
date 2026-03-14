import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IMerchantRepository } from '../interfaces/merchant-repository.interface';
import { EncryptionService } from '../../../common/security/encryption.service';
import { QrService } from '../../qr/services/qr.service';
import { QR_CONSTANTS } from '../../qr/constants/qr.constants';
import { PDF_CONSTANTS } from '../../pdf/constants/pdf.constants';
import { MERCHANT_CONSTANTS } from '../constants/merchant.constants';
import { PaymentLinkResponseDto } from '../dto/payment-link.dto';

export interface GeneratePaymentLinkInput {
  merchantId: number;
  includeQr?: boolean;
}

@Injectable()
export class GeneratePaymentLinkUseCase {
  constructor(
    @Inject('IMerchantRepository') private readonly merchantRepo: IMerchantRepository,
    private readonly encryptionService: EncryptionService,
    private readonly qrService: QrService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: GeneratePaymentLinkInput): Promise<PaymentLinkResponseDto> {
    const merchant = await this.merchantRepo.findById(input.merchantId);
    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${input.merchantId} not found`);
    }

    if (!merchant.isActive()) {
      throw new Error('Merchant is not active or verified');
    }

    const payload = {
      mid: merchant.id,
      uid: merchant.user_id,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + MERCHANT_CONSTANTS.PAYMENT_LINK_TTL_HOURS * 60 * 60 * 1000).toISOString(),
    };

    const encryptedToken = this.encryptionService.encryptPayload(JSON.stringify(payload));

    const publicUrl = `${this.configService.get('PUBLIC_URL') || 'https://pay.example.com'}/pay?token=${encryptedToken}`;

    let qrCodeDataUrl = '';
    if (input.includeQr !== false) {
      // generate a data URL using the QR service
      qrCodeDataUrl = await this.qrService.generate({ data: publicUrl, size: 300, errorCorrection: 'H' });

      // Emit QR generated event to trigger downstream PDF generation and auditing
      this.eventEmitter.emit(QR_CONSTANTS.EVENTS.GENERATED, {
        merchantId: merchant.id,
        qrCodeDataUrl,
        paymentUrl: publicUrl,
        filePath: undefined,
        timestamp: new Date(),
      });
    }

    // Emit the domain-level payment link generated event as well
    this.eventEmitter.emit(MERCHANT_CONSTANTS.EVENTS.PAYMENT_LINK_GENERATED, {
      merchantId: merchant.id,
      userId: merchant.user_id,
      encryptedToken,
      publicUrl,
      timestamp: new Date(),
    });

    return {
      merchant_id: merchant.id,
      merchant_name: merchant.business_name,
      payment_url: publicUrl,
      encrypted_token: encryptedToken,
      qr_code_data_url: qrCodeDataUrl,
      expires_at: new Date(payload.expiresAt),
      created_at: new Date(),
    };
  }
}
