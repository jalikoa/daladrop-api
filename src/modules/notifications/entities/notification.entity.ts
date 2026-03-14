import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { NotificationChannel, NotificationStatus, NotificationPriority } from '../enums/notification-channel.enum';

@Entity('notifications', { schema: 'notifications' })
@Index(['user_id'])
@Index(['status'])
@Index(['channel'])
@Index(['created_at'])
@Index(['user_id', 'status', 'created_at'])
export class Notification {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', nullable: true })
  @Index()
  user_id: number | null;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipient: string | null;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subject: string | null;

  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.QUEUED })
  status: NotificationStatus;

  @Column({ type: 'enum', enum: NotificationPriority, default: NotificationPriority.NORMAL })
  priority: NotificationPriority;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  provider_message_id: string | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'int', default: 0 })
  retry_count: number;

  @Column({ type: 'json', nullable: true })
  meta: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  template_data: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  template_name: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  delivered_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  failed_at: Date | null;

  toJSON(): Record<string, unknown> {
    const { ...values } = { ...this };
    return values;
  }

  canRetry(): boolean {
    return this.retry_count < 5 && this.status === NotificationStatus.FAILED;
  }

  markSent(providerMessageId?: string): void {
    this.status = NotificationStatus.SENT;
    this.sent_at = new Date();
    if (providerMessageId) this.provider_message_id = providerMessageId;
  }

  markDelivered(): void {
    this.status = NotificationStatus.DELIVERED;
    this.delivered_at = new Date();
  }

  markFailed(error: string): void {
    this.status = NotificationStatus.FAILED;
    this.error_message = error;
    this.failed_at = new Date();
    this.retry_count += 1;
  }

  markCancelled(): void {
    this.status = NotificationStatus.CANCELLED;
  }
}
