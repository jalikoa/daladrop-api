import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { NotificationChannel } from './enums/notification-channel.enum';
import { NOTIFICATION_CONSTANTS } from './constants/notification.constants';
import { NotificationsRepository } from './repositories/notifications.repository';
import { QueryNotificationDto } from './dto/query-notifications.dto';
import { NotificationMapper } from './mappers/notification.mapper';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue(NOTIFICATION_CONSTANTS.QUEUE.NAME) private readonly notificationQueue: Queue,
    private readonly notificationsRepository: NotificationsRepository,
    private readonly notificationMapper: NotificationMapper,
  ) {}

  async sendSms(phone: string, message: string): Promise<void> {
    await this.notificationQueue.add('send.sms', { phone, message });
  }

  async sendEmail(email: string, subject: string, body: string): Promise<void> {
    await this.notificationQueue.add('send.email', { email, subject, body });
  }

  async sendPush(token: string, title: string, body: string): Promise<void> {
    await this.notificationQueue.add('send.push', { token, title, body });
  }

  async queueNotification(
    channel: NotificationChannel,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.notificationQueue.add(`send.${channel.toLowerCase()}`, data);
  }

  async getNotifications(page: number = 1, limit: number = 20): Promise<{ data: QueryNotificationDto[]; total: number }> {
    const result = await this.notificationsRepository.findAll(page, limit);
    const data = this.notificationMapper.toMany(result.data);
    return { data, total: result.total };
  }
}
