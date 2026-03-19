import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PdfService } from './services/pdf.service';
import { PdfController } from './pdf.controller';
import { PdfListener } from './listeners/pdf.listener';
import { PdfProcessor } from './processors/pdf.processor';
import { PDF_CONSTANTS } from './constants/pdf.constants';
import { QrModule } from '../qr/qr.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { NOTIFICATION_CONSTANTS } from '../notifications/constants/notification.constants';
import { NfcModule } from '../nfc/nfc.module';
import { NfcService } from '../nfc/nfc.service';
import { MerchantsService } from '../merchants/merchants.service';
@Module({
  imports: [
    // ── Queues this module owns or uses ────────────────────────────────────
    BullModule.registerQueue(
      // PdfProcessor listens on this queue
      {
        name: PDF_CONSTANTS.EVENT_PREFIX + '-queue',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      },
      // PdfListener.notificationQueue — inject token must be registered here
      { name: NOTIFICATION_CONSTANTS.QUEUE.NAME },
      // PdfListener.auditQueue
      { name: 'audit-queue' },
    ),
    QrModule,
    MerchantsModule,
    NfcModule,
  ],
  providers: [PdfService, PdfListener, PdfProcessor],
  controllers: [PdfController],
  exports: [PdfService],
})
export class PdfModule {}