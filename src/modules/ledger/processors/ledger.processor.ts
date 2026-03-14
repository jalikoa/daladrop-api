import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { LEDGER_CONSTANTS } from '../constants/ledger.constants';
import { Injectable, Logger } from '@nestjs/common';

@Processor(LEDGER_CONSTANTS.QUEUE.NAME)
@Injectable()
export class LedgerProcessor {
  private readonly logger = new Logger(LedgerProcessor.name);

  @Process()
  async handle(job: Job) {
    this.logger.debug(`Processing ledger job ${job.id} type=${job.name}`);
    // Job payload expected to contain transactionId and entries
    const { transactionId, entries } = job.data || {};
    // In this simple processor we just log — use LedgerService/UseCase in future
    this.logger.debug({ transactionId, entries });
    return { ok: true };
  }
}
