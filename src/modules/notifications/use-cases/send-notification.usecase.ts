import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../enums/notification-channel.enum';
import type { SmsProvider } from '../interfaces/sms-provider.interface';
import type { EmailProvider } from '../interfaces/email-provider.interface';
import type { PushProvider } from '../interfaces/push-provider.interface';

export interface SendNotificationDto {
  userId?: number;
  channel: NotificationChannel;
  recipient: string;
  message: string;
  subject?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SendNotificationUseCase {
  constructor(
    private readonly smsProvider: SmsProvider,
    private readonly emailProvider: EmailProvider,
    private readonly pushProvider: PushProvider,
  ) {}

  async execute(dto: SendNotificationDto): Promise<boolean> {
    switch (dto.channel) {
      case NotificationChannel.SMS:
        return (await this.smsProvider.send(dto.recipient, dto.message)).success;
      case NotificationChannel.EMAIL:
        return (
          await this.emailProvider.send(dto.recipient, dto.subject || '', dto.message)
        ).success;
      case NotificationChannel.PUSH:
        return (await this.pushProvider.sendToDevice(dto.recipient, 'Notification', dto.message))
          .success;
      default:
        throw new Error('Invalid notification channel');
    }
  }
}
