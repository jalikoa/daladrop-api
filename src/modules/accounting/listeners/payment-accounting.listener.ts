import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { PaymentEvent } from '../../payments/domain/payment';
import { PostingEngineService } from '../use-cases/posting-engine.service';

/**
 * Provider-agnostic accounting reaction to payment capture.
 * Never calls payment gateways — ledger posts from PaymentCompleted only.
 */
@Injectable()
export class PaymentAccountingListener {
  private readonly logger = new Logger(PaymentAccountingListener.name);

  public constructor(private readonly postingEngine: PostingEngineService) {}

  @OnEvent('payments.PaymentCompleted')
  public async onPaymentCompleted(event: PaymentEvent): Promise<void> {
    try {
      const result = await this.postingEngine.postPaymentCollected(event);
      this.logger.log(
        `Journal ${result.journal.entryNumber} for payment ${result.journal.paymentId}` +
          (result.idempotent ? ' (idempotent)' : ''),
      );
    } catch (error) {
      this.logger.error(
        `Failed to post accounting for payment ${event.aggregateId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
