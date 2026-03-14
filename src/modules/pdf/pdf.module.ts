import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PdfService } from './services/pdf.service';
import { PdfController } from './pdf.controller';
import { PdfListener } from './listeners/pdf.listener';
import { PdfProcessor } from './processors/pdf.processor';
import { PDF_CONSTANTS } from './constants/pdf.constants';
import { QrModule } from '../qr/qr.module';
import { MerchantsModule } from '../merchants/merchants.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: PDF_CONSTANTS.EVENT_PREFIX + '-queue',
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 50, removeOnFail: 100 },
    }),
    EventEmitterModule.forRoot(),
    QrModule,
    MerchantsModule,
  ],
  providers: [PdfService, PdfListener, PdfProcessor],
  controllers: [PdfController],
  exports: [PdfService],
})
export class PdfModule {}
