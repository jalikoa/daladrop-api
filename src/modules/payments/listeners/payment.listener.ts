import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PAYMENT_CONSTANTS } from '../constants/payment.constants';
import {
  PaymentSessionCreatedEvent,
  PaymentInitiatedEvent,
  PaymentCompletedEvent,
  PaymentFailedEvent,
} from '../events/payment.events';

@Injectable()
export class PaymentListener {
  private readonly logger = new Logger(PaymentListener.name);

  constructor(
    @InjectQueue(PAYMENT_CONSTANTS.QUEUE.NAME)
    private readonly paymentQueue: Queue,
    @InjectQueue('audit-queue')
    private readonly auditQueue: Queue,
  ) {}

  @OnEvent(PAYMENT_CONSTANTS.EVENTS.SESSION_CREATED)
  async handleSessionCreated(event: PaymentSessionCreatedEvent) {
    this.logger.log(`Payment session created: ${event.sessionUuid}`);

    await this.auditQueue.add('log.action', {
      action: 'PAYMENT_SESSION_CREATED',
      payload: { sessionUuid: event.sessionUuid, merchantId: event.merchantId, amount: event.amount },
    });
  }

  @OnEvent(PAYMENT_CONSTANTS.EVENTS.INITIATED)
  async handlePaymentInitiated(event: PaymentInitiatedEvent) {
    this.logger.log(`Payment initiated: ${event.sessionUuid}`);

    await this.paymentQueue.add('payment.timeout.check', {
      paymentId: event.paymentId,
      checkoutRequestId: event.checkoutRequestId,
      timeoutAt: Date.now() + PAYMENT_CONSTANTS.STK.TIMEOUT_SECONDS * 1000,
    }, { delay: PAYMENT_CONSTANTS.STK.TIMEOUT_SECONDS * 1000 });

    await this.auditQueue.add('log.action', {
      action: 'PAYMENT_INITIATED',
      payload: { paymentId: event.paymentId, checkoutRequestId: event.checkoutRequestId, amount: event.amount },
    });
  }

  @OnEvent(PAYMENT_CONSTANTS.EVENTS.COMPLETED)
  async handlePaymentCompleted(event: PaymentCompletedEvent) {
    this.logger.log(`Payment completed: ${event.sessionUuid} - Receipt: ${event.receipt}`);

    await this.paymentQueue.add(PAYMENT_CONSTANTS.QUEUE.PROCESSORS.COMPLETED, {
      paymentId: event.paymentId,
      sessionUuid: event.sessionUuid,
      merchantId: event.merchantId,
      customerPhone: event.customerPhone,
      amount: event.amount,
      receipt: event.receipt,
      timestamp: event.timestamp,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    await this.auditQueue.add('log.action', {
      action: 'PAYMENT_COMPLETED',
      payload: { paymentId: event.paymentId, receipt: event.receipt, amount: event.amount },
    });
  }

  @OnEvent(PAYMENT_CONSTANTS.EVENTS.FAILED)
  async handlePaymentFailed(event: PaymentFailedEvent) {
    this.logger.warn(`Payment failed: ${event.sessionUuid} - ${event.reason}`);

    await this.paymentQueue.add(PAYMENT_CONSTANTS.QUEUE.PROCESSORS.FAILED, {
      paymentId: event.paymentId,
      sessionUuid: event.sessionUuid,
      merchantId: event.merchantId,
      reason: event.reason,
      code: event.code,
      timestamp: event.timestamp,
    });

    await this.auditQueue.add('log.action', {
      action: 'PAYMENT_FAILED',
      payload: { paymentId: event.paymentId, reason: event.reason, code: event.code },
    });
  }
}
