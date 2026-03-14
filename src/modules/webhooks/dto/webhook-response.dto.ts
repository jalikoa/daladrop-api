import { Expose, Transform } from 'class-transformer';
import { WebhookStatus, WebhookSource } from '../enums/webhook-source.enum';

export class WebhookResponseDto {
  @Expose()
  success: boolean;

  @Expose()
  message: string;

  @Expose()
  meta: {
    webhook_id: number;
    source: WebhookSource;
    status: WebhookStatus;
    processed_at: Date | null;
  };

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  received_at: Date;
}

export class WebhookLogResponseDto {
  @Expose()
  id: number;

  @Expose()
  source: WebhookSource;

  @Expose()
  event_type: string;

  @Expose()
  status: WebhookStatus;

  @Expose()
  ip_address: string;

  @Expose()
  payload: Record<string, unknown>;

  @Expose()
  response_sent: Record<string, unknown> | null;

  @Expose()
  error_message: string | null;

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  received_at: Date;

  @Expose()
  @Transform(({ value }) => (value ? value.toISOString() : null))
  processed_at: Date | null;
}
