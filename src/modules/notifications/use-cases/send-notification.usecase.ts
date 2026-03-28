import { Injectable, Inject, BadRequestException, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(SendNotificationUseCase.name);

  constructor(
    @Inject('ISmsProvider') private readonly smsProvider: SmsProvider,
    @Inject('IEmailProvider') private readonly emailProvider: EmailProvider,
    @Inject('IPushProvider') private readonly pushProvider: PushProvider,
  ) {}

  async execute(dto: SendNotificationDto): Promise<boolean> {
    this.logger.log(`Processing notification request`);
    this.logger.log(`   Channel: ${dto.channel}`);
    this.logger.log(`   Recipient: ${dto.recipient}`);

    switch (dto.channel) {
      case NotificationChannel.SMS:
        this.logger.log(`   Dispatching to SMS provider`);
        return (await this.smsProvider.send(dto.recipient, dto.message)).success;
      case NotificationChannel.EMAIL:
        this.logger.log(`   Dispatching to Email provider`);
        return (
          await this.emailProvider.send(dto.recipient, dto.subject || '', dto.message)
        ).success;
      case NotificationChannel.PUSH:
        this.logger.log(`   Dispatching to Push provider`);
        return (await this.pushProvider.sendToDevice(dto.recipient, dto.subject || 'Notification', dto.message))
          .success;
      default:
        this.logger.error(`Unsupported notification channel: ${dto.channel}`);
        throw new BadRequestException(
          `Unsupported notification channel: "${dto.channel}". ` +
          `Supported channels: SMS, EMAIL, PUSH`,
        );
    }
  }
}
