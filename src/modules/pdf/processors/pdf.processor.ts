import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PdfService } from '../services/pdf.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PDF_CONSTANTS } from '../constants/pdf.constants';
import { MerchantCardData } from '../value-objects/pdf-document.vo';
import * as path from 'path';

export interface MerchantCardJobData {
  merchantId: number;
  userId: number;
  businessName: string;
  businessEmail?: string | null;
  businessPhone?: string | null;
  logoUrl?: string | null;
  paybillNumber: string;
  accountNumber: string;
  qrCodeDataUrl: string;
  paymentUrl: string;
}

@Processor(PDF_CONSTANTS.EVENT_PREFIX + '-queue')
export class PdfProcessor {
  private readonly logger = new Logger(PdfProcessor.name);

  constructor(
    private readonly pdfService: PdfService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Process('merchant.card.generate')
  async handleMerchantCardGeneration(job: Job<MerchantCardJobData>) {
    const {
      merchantId,
      userId,
      businessName,
      businessEmail,
      businessPhone,
      logoUrl,
      paybillNumber,
      accountNumber,
      qrCodeDataUrl,
      paymentUrl,
    } = job.data;

    try {
      this.logger.log(`Processing merchant card generation for merchant ${merchantId}`);

      // 1. Generate PDF
      const merchantCardData: MerchantCardData = {
        merchantId,
        businessName,
        businessEmail,
        businessPhone,
        logoUrl,
        paybillNumber,
        accountNumber,
        qrCodeDataUrl,
        paymentUrl,
        generatedAt: new Date(),
      };

      const { buffer, filePath, info } = await this.pdfService.generateAndSaveMerchantCard(
        merchantCardData,
        `merchant_${merchantId}_card_${Date.now()}.pdf`,
      );

      // 2. Generate public URL (in production, upload to CDN/S3)
      const pdfUrl = `https://cdn.example.com/pdf/${path.basename(filePath)}`;
      const qrUrl = `https://cdn.example.com/qr/merchant_${merchantId}.png`;

      // 3. Save to database (merchant_cards table)
      // This would be done via a repository in production
      // await this.merchantCardRepo.create({ merchantId, pdfUrl, qrUrl });

      // 4. Emit event for notifications
      this.eventEmitter.emit(PDF_CONSTANTS.EVENTS.MERCHANT_CARD_GENERATED, {
        merchantId,
        userId,
        pdfUrl,
        qrUrl,
        timestamp: new Date(),
      });

      this.logger.log(`Merchant card generated successfully: ${filePath} (${info.sizeFormatted})`);

      return {
        success: true,
        merchantId,
        filePath,
        pdfUrl,
        fileSize: info.size,
      };
    } catch (error) {
      this.logger.error('Failed to generate merchant card', error);
      throw error; // BullMQ will retry based on queue config
    }
  }
}
