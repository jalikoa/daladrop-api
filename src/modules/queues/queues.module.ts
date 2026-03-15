import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueuesController } from './queues.controller';
import { QueuesService, QUEUE_NAMES } from './queues.service';

@Module({
  imports: [
    // Register every queue this admin module needs to inspect/manage.
    // These mirror the registrations in LedgerModule and PdfModule — Bull
    // deduplicates the underlying Redis connections automatically.
    BullModule.registerQueue({ name: QUEUE_NAMES.LEDGER }),
    BullModule.registerQueue({ name: QUEUE_NAMES.PDF }),
    BullModule.registerQueue({ name: QUEUE_NAMES.PDF_REPORT }),
  ],
  controllers: [QueuesController],
  providers: [QueuesService],
  exports: [QueuesService],
})
export class QueuesModule {}