import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PDF_CONSTANTS } from '../constants/pdf.constants';
import { MerchantCardGeneratedEvent } from '../events/pdf.events';

@Injectable()
export class PdfListener {
  private readonly logger = new Logger(PdfListener.name);

  constructor(
    @InjectQueue('notification-events') private readonly notificationQueue: Queue,
    @InjectQueue('audit-queue') private readonly auditQueue: Queue,
  ) {}

  @OnEvent(PDF_CONSTANTS.EVENTS.MERCHANT_CARD_GENERATED)
  async handleMerchantCardGenerated(event: MerchantCardGeneratedEvent) {
    this.logger.log(`Merchant card generated for merchant ${event.merchantId}`);

    // Send notification to merchant
    await this.notificationQueue.add('send.email', {
      // Fetch merchant email from users module
      subject: 'Your NFC Payment Card is Ready',
      body: `
        <h1>Your Payment Card is Ready!</h1>
        <p>Download your NFC payment card with QR code.</p>
        <p><a href="${event.pdfUrl}">Download PDF</a></p>
      `,
    });

    // Audit: Log card generation
    await this.auditQueue.add('log.action', {
      userId: event.userId,
      action: 'MERCHANT_CARD_GENERATED',
      payload: {
        merchantId: event.merchantId,
        pdfUrl: event.pdfUrl,
        qrUrl: event.qrUrl,
      },
    });
  }
}
