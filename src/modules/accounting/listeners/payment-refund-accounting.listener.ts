import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RefundStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { PaymentEvent } from '../../payments/domain/payment';
import { PostingEngineService } from '../use-cases/posting-engine.service';

/**
 * Provider-agnostic accounting reaction to a settled refund.
 * Resolves the refundId from the event payload, falling back to the latest
 * SUCCEEDED refund without a journal for the payment (in case a provider
 * callback path emits PaymentRefunded without a refundId).
 */
@Injectable()
export class PaymentRefundAccountingListener {
  private readonly logger = new Logger(PaymentRefundAccountingListener.name);

  public constructor(
    private readonly postingEngine: PostingEngineService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('payments.PaymentRefunded')
  public async onPaymentRefunded(event: PaymentEvent): Promise<void> {
    try {
      const refundId = await this.resolveRefundId(event);
      if (!refundId) {
        this.logger.warn(
          `PaymentRefunded for ${event.aggregateId} has no resolvable refundId — skipping`,
        );
        return;
      }
      const result = await this.postingEngine.postPaymentRefunded(refundId);
      this.logger.log(
        `Journal ${result.journal.entryNumber} for refund ${refundId}` +
          (result.idempotent ? ' (idempotent)' : ''),
      );
    } catch (error) {
      this.logger.error(
        `Failed to post refund accounting for payment ${event.aggregateId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  private async resolveRefundId(event: PaymentEvent): Promise<string | null> {
    if (typeof event.payload.refundId === 'string') {
      return event.payload.refundId;
    }
    const paymentId = event.aggregateId;
    if (!paymentId) return null;
    const refund = await this.prisma.refund.findFirst({
      where: {
        paymentId,
        status: RefundStatus.SUCCEEDED,
        journalEntryId: null,
      },
      orderBy: { completedAt: 'desc' },
    });
    return refund?.id ?? null;
  }
}
