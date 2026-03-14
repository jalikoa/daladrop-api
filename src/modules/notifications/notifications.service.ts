import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { NotificationChannel } from './enums/notification-channel.enum';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue('notification-events') private readonly notificationQueue: Queue,
    @InjectQueue('notification-events') private readonly smsQueue: Queue,
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
}
