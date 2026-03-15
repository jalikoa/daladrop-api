import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MetricsService } from '../../metrics/metrics.service';
import { AppLogger } from '../../logger/logger.service';
import { NFC_CONSTANTS } from '../../nfc/constants/nfc.constants';
import { WEBHOOK_CONSTANTS } from '../../webhooks/constants/webhook.constants';
import { NOTIFICATION_CONSTANTS } from '../../notifications/constants/notification.constants';

// ─── NFC ─────────────────────────────────────────────────────────────────────
@Injectable()
export class NfcMetricsListener {
  constructor(
    private readonly metrics: MetricsService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(NfcMetricsListener.name);
  }

  @OnEvent(NFC_CONSTANTS.EVENTS.PAYMENT_SESSION_STARTED)
  handleNfcTap(payload: { merchantId: number; sessionUuid: string; ipAddress?: string }) {
    this.metrics.recordNfcTap(payload.merchantId);
    this.logger.log('NFC tap decoded', {
      type: 'nfc_tap',
      merchantId: payload.merchantId,
      sessionUuid: payload.sessionUuid,
      ipAddress: payload.ipAddress,
    });
  }
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────
@Injectable()
export class WebhookMetricsListener {
  constructor(
    private readonly metrics: MetricsService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(WebhookMetricsListener.name);
  }

  @OnEvent(WEBHOOK_CONSTANTS.EVENTS.RECEIVED)
  handleWebhookReceived(payload: { source: string; webhookId: number; eventType: string }) {
    this.metrics.recordWebhook(payload.source, 'RECEIVED');
    this.logger.log(`Webhook received: ${payload.source}/${payload.eventType}`, {
      type: 'webhook_received',
      source: payload.source,
      eventType: payload.eventType,
      webhookId: payload.webhookId,
    });
  }

  @OnEvent(WEBHOOK_CONSTANTS.EVENTS.PROCESSED)
  handleWebhookProcessed(payload: { source: string; webhookId: number; success: boolean }) {
    const status = payload.success ? 'COMPLETED' : 'FAILED';
    this.metrics.recordWebhook(payload.source, status);
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────
@Injectable()
export class NotificationMetricsListener {
  constructor(
    private readonly metrics: MetricsService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(NotificationMetricsListener.name);
  }

  @OnEvent(NOTIFICATION_CONSTANTS.EVENTS.QUEUED)
  handleNotificationQueued(payload: { channel: string; userId?: number }) {
    this.metrics.recordNotification(payload.channel);
  }
}