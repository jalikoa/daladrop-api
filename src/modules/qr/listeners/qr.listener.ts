import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { QR_CONSTANTS } from '../constants/qr.constants';
import { QrGeneratedEvent } from '../events/qr.events';

@Injectable()
export class QrListener {
  private readonly logger = new Logger(QrListener.name);

  constructor(
    @InjectQueue('pdf-queue') private readonly pdfQueue: Queue,
    @InjectQueue('audit-queue') private readonly auditQueue: Queue,
  ) {}

  @OnEvent(QR_CONSTANTS.EVENTS.GENERATED)
  async handleQrGenerated(event: QrGeneratedEvent) {
    this.logger.log(`QR code generated for merchant ${event.merchantId}`);

    if (event.paymentUrl) {
      await this.pdfQueue.add('merchant.card.generate', {
        merchantId: event.merchantId,
        qrCodeDataUrl: event.qrCodeDataUrl,
        paymentUrl: event.paymentUrl,
        timestamp: event.timestamp,
      });
    }

    await this.auditQueue.add('log.action', {
      action: 'QR_CODE_GENERATED',
      payload: {
        merchantId: event.merchantId,
        filePath: event.filePath,
      },
    });
  }
}