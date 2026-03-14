import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IWebhookHandler, WebhookProcessResult } from '../interfaces/webhook-handler.interface';
import { WebhookLog } from '../entities/webhook-log.entity';

@Injectable()
export class AfricaTalkingWebhookHandler implements IWebhookHandler {
  private readonly logger = new Logger(AfricaTalkingWebhookHandler.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async validate(payload: unknown, headers: Record<string, string>): Promise<boolean> {
    if (!payload || typeof payload !== 'object') return false;
    const data = payload as Record<string, unknown>;
    if (!data.sessionId || !data.phoneNumber) return false;
    return true;
  }

  async process(payload: unknown, log: WebhookLog): Promise<WebhookProcessResult> {
    try {
      const data = payload as Record<string, any>;
      this.logger.log(`Processing Africa's Talking callback: ${data.sessionId}`);

      this.eventEmitter.emit('ussd.session', {
        sessionId: data.sessionId,
        phoneNumber: data.phoneNumber,
        text: data.text,
        serviceCode: data.serviceCode,
        requestType: data.requestType,
        timestamp: new Date(),
      });

      return { success: true, eventsEmitted: ['ussd.session'], data };
    } catch (error) {
      this.logger.error("Failed to process Africa's Talking callback", error);
      return { success: false, eventsEmitted: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  getEventType(payload: unknown): string {
    return 'ussd.session';
  }

  getIdempotencyKey(payload: unknown): string | null {
    return (payload as Record<string, any>)?.sessionId || null;
  }
}
