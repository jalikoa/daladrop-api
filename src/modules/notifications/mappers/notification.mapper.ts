import { Injectable } from '@nestjs/common';
import { Notification } from '../entities/notification.entity';
import { QueryNotificationDto } from '../dto/query-notifications.dto';

@Injectable()
export class NotificationMapper {
  toDto(notification: Notification): QueryNotificationDto {
    return {
      id: notification.id,
      userId: notification.user_id || 0,
      channel: notification.channel,
      recipient: notification.recipient || '',
      subject: notification.subject || undefined,
      message: notification.message,
      priority: notification.priority as 'LOW' | 'NORMAL' | 'HIGH',
      status: notification.status as 'SENT' | 'DELIVERED' | 'FAILED',
      createdAt: notification.created_at.toISOString(),
      deliveredAt: notification.delivered_at?.toISOString() || '',
    };
  }

  toMany(notifications: Notification[]): QueryNotificationDto[] {
    return notifications.map((notification) => this.toDto(notification));
  }
}
