import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MetricsService } from '../../metrics/metrics.service';
import { AppLogger } from '../../logger/logger.service';
import { PAYMENT_CONSTANTS } from '../../payments/constants/payment.constants';

/**
 * PaymentMetricsListener
 *
 * Listens to domain payment events emitted by the payments module
 * and records them in Prometheus. Injected as a provider into PaymentsModule.
 *
 * Wire up: add PaymentMetricsListener to PaymentsModule.providers[]
 */
@Injectable()
export class PaymentMetricsListener {
  constructor(
    private readonly metrics: MetricsService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(PaymentMetricsListener.name);
  }

  @OnEvent(PAYMENT_CONSTANTS.EVENTS.INITIATED)
  handlePaymentInitiated(payload: { merchantId: number; sessionUuid: string; amount: number; phone: string }) {
    this.metrics.recordPaymentInitiated(payload.merchantId);
    this.logger.logPayment({
      event: 'initiated',
      sessionUuid: payload.sessionUuid,
      merchantId: payload.merchantId,
      amount: payload.amount,
      phone: payload.phone,
      status: 'INITIATED',
    });
  }

  @OnEvent(PAYMENT_CONSTANTS.EVENTS.COMPLETED)
  handlePaymentCompleted(payload: { merchantId: number; sessionUuid: string; amount: number }) {
    this.metrics.recordPaymentCompleted(payload.merchantId, payload.amount);
    this.logger.logPayment({
      event: 'completed',
      sessionUuid: payload.sessionUuid,
      merchantId: payload.merchantId,
      amount: payload.amount,
      status: 'COMPLETED',
    });
  }

  @OnEvent(PAYMENT_CONSTANTS.EVENTS.FAILED)
  handlePaymentFailed(payload: { merchantId: number; sessionUuid: string; reason?: string }) {
    this.metrics.recordPaymentFailed(payload.merchantId, payload.reason || 'unknown');
    this.logger.logPayment({
      event: 'failed',
      sessionUuid: payload.sessionUuid,
      merchantId: payload.merchantId,
      status: 'FAILED',
    });
  }
}