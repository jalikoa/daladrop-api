import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WEBHOOK_CONSTANTS } from '../constants/webhook.constants';

@Injectable()
export class WebhookListener {
  private readonly logger = new Logger(WebhookListener.name);

  @OnEvent(WEBHOOK_CONSTANTS.EVENTS.RECEIVED)
  handleReceived(payload: { webhookId: number; source: string; eventType: string }) {
    this.logger.log(`Webhook received ${payload.webhookId} from ${payload.source} (${payload.eventType})`);
  }

  @OnEvent(WEBHOOK_CONSTANTS.EVENTS.PROCESSED)
  handleProcessed(payload: { webhookId: number; source: string; success: boolean; eventsEmitted: string[] }) {
    this.logger.log(`Webhook processed ${payload.webhookId} success=${payload.success}`);
  }
}
