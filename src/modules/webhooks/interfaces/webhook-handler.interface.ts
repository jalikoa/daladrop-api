import { WebhookLog } from '../entities/webhook-log.entity';

export interface IWebhookHandler {
  validate(payload: unknown, headers: Record<string, string>): Promise<boolean>;
  process(payload: unknown, log: WebhookLog): Promise<WebhookProcessResult>;
  getEventType(payload: unknown): string;
  getIdempotencyKey(payload: unknown): string | null;
}

export interface WebhookProcessResult {
  success: boolean;
  eventsEmitted: string[];
  data?: Record<string, unknown>;
  error?: string;
}
