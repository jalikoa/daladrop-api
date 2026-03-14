import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { WebhookSource, WebhookStatus } from '../enums/webhook-source.enum';

@Entity('webhook_logs', { schema: 'audit' })
@Index(['source', 'event_id'])
@Index(['status'])
@Index(['received_at'])
export class WebhookLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'enum', enum: WebhookSource })
  source: WebhookSource;

  @Column({ type: 'varchar', length: 100 })
  event_type: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  event_id: string | null;

  @Column({ type: 'enum', enum: WebhookStatus, default: WebhookStatus.RECEIVED })
  status: WebhookStatus;

  @Column({ type: 'varchar', length: 45 })
  ip_address: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_agent: string | null;

  @Column({ type: 'json' })
  payload: Record<string, unknown>;

  @Column({ type: 'json', nullable: true })
  response_sent: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'int', default: 0 })
  retry_count: number;

  @Column({ type: 'boolean', default: false })
  is_duplicate: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  idempotency_key: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  received_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  processed_at: Date | null;

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      source: this.source,
      event_type: this.event_type,
      status: this.status,
      event_id: this.event_id,
      received_at: this.received_at,
      processed_at: this.processed_at,
    };
  }

  markProcessed(): void {
    this.status = WebhookStatus.COMPLETED;
    this.processed_at = new Date();
  }

  markFailed(error: string): void {
    this.status = WebhookStatus.FAILED;
    this.error_message = error;
  }

  markDuplicate(): void {
    this.status = WebhookStatus.DUPLICATE;
    this.is_duplicate = true;
  }

  canRetry(): boolean {
    return this.retry_count < 3 && this.status === WebhookStatus.FAILED;
  }

  incrementRetry(): void {
    this.retry_count += 1;
  }
}
