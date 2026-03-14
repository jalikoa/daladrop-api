import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { QrService } from './services/qr.service';
import { QrController } from './qr.controller';
import { QrListener } from './listeners/qr.listener';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'pdf-queue' }, { name: 'audit-queue' }),
    EventEmitterModule.forRoot(),
  ],
  providers: [QrService, QrListener],
  controllers: [QrController],
  exports: [QrService],
})
export class QrModule {}
