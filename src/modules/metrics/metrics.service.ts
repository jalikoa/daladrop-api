import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  public readonly registry: Registry;
  public readonly httpRequestsTotal: Counter<string>;
  public readonly httpRequestDuration: Histogram<string>;
  public readonly httpRequestsInFlight: Gauge<string>;
  public readonly httpErrorsTotal: Counter<string>;
  public readonly paymentsInitiated: Counter<string>;
  public readonly paymentsCompleted: Counter<string>;
  public readonly paymentsFailed: Counter<string>;
  public readonly paymentAmountTotal: Counter<string>;
  public readonly nfcTapsTotal: Counter<string>;
  public readonly nfcDecodeErrors: Counter<string>;
  public readonly webhooksReceived: Counter<string>;
  public readonly notificationsQueued: Counter<string>;
  public readonly authAttempts: Counter<string>;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry, prefix: 'nodejs_' });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total', help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status_code'], registers: [this.registry],
    });
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds', help: 'HTTP latency in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });
    this.httpRequestsInFlight = new Gauge({
      name: 'http_requests_in_flight', help: 'Requests currently being processed',
      labelNames: ['method'], registers: [this.registry],
    });
    this.httpErrorsTotal = new Counter({
      name: 'http_errors_total', help: 'Total 4xx and 5xx responses',
      labelNames: ['method', 'route', 'status_code'], registers: [this.registry],
    });
    this.paymentsInitiated = new Counter({
      name: 'payments_initiated_total', help: 'STK push initiations',
      labelNames: ['merchant_id'], registers: [this.registry],
    });
    this.paymentsCompleted = new Counter({
      name: 'payments_completed_total', help: 'Payments completed',
      labelNames: ['merchant_id'], registers: [this.registry],
    });
    this.paymentsFailed = new Counter({
      name: 'payments_failed_total', help: 'Payments failed',
      labelNames: ['merchant_id', 'reason'], registers: [this.registry],
    });
    this.paymentAmountTotal = new Counter({
      name: 'payment_amount_kes_total', help: 'Total KES processed',
      labelNames: ['merchant_id'], registers: [this.registry],
    });
    this.nfcTapsTotal = new Counter({
      name: 'nfc_taps_total', help: 'NFC/QR token decode requests',
      labelNames: ['merchant_id'], registers: [this.registry],
    });
    this.nfcDecodeErrors = new Counter({
      name: 'nfc_decode_errors_total', help: 'NFC decode failures',
      labelNames: ['reason'], registers: [this.registry],
    });
    this.webhooksReceived = new Counter({
      name: 'webhooks_received_total', help: 'Webhooks received',
      labelNames: ['source', 'status'], registers: [this.registry],
    });
    this.notificationsQueued = new Counter({
      name: 'notifications_queued_total', help: 'Notifications queued',
      labelNames: ['channel'], registers: [this.registry],
    });
    this.authAttempts = new Counter({
      name: 'auth_attempts_total', help: 'Authentication attempts',
      labelNames: ['result'], registers: [this.registry],
    });
  }

  onModuleInit(): void {}

  async getMetrics(): Promise<string> { return this.registry.metrics(); }

  recordPaymentInitiated(merchantId: number): void {
    this.paymentsInitiated.inc({ merchant_id: String(merchantId) });
  }
  recordPaymentCompleted(merchantId: number, amountKes: number): void {
    const l = { merchant_id: String(merchantId) };
    this.paymentsCompleted.inc(l);
    this.paymentAmountTotal.inc(l, amountKes);
  }
  recordPaymentFailed(merchantId: number, reason: string): void {
    this.paymentsFailed.inc({ merchant_id: String(merchantId), reason });
  }
  recordNfcTap(merchantId: number): void {
    this.nfcTapsTotal.inc({ merchant_id: String(merchantId) });
  }
  recordNfcDecodeError(reason: string): void {
    this.nfcDecodeErrors.inc({ reason });
  }
  recordWebhook(source: string, status: string): void {
    this.webhooksReceived.inc({ source, status });
  }
  recordNotification(channel: string): void {
    this.notificationsQueued.inc({ channel });
  }
  recordAuthAttempt(result: 'success' | 'failure'): void {
    this.authAttempts.inc({ result });
  }
}