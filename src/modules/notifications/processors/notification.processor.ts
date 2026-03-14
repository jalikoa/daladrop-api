import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { SendNotificationUseCase } from '../use-cases/send-notification.usecase';
import { NotificationChannel } from '../enums/notification-channel.enum';

@Processor('notification-events')
export class NotificationProcessor {
  constructor(private readonly sendNotificationUseCase: SendNotificationUseCase) {}

  @Process('send.sms')
  async sendSms(job: Job<{ phone: string; message: string }>) {
    return this.sendNotificationUseCase.execute({
      channel: NotificationChannel.SMS,
      recipient: job.data.phone,
      message: job.data.message,
    });
  }

  @Process('send.email')
  async sendEmail(job: Job<{ email: string; subject: string; body: string }>) {
    return this.sendNotificationUseCase.execute({
      channel: NotificationChannel.EMAIL,
      recipient: job.data.email,
      subject: job.data.subject,
      message: job.data.body,
    });
  }

  @Process('send.push')
  async sendPush(job: Job<{ token: string; title: string; body: string }>) {
    return this.sendNotificationUseCase.execute({
      channel: NotificationChannel.PUSH,
      recipient: job.data.token,
      message: job.data.body,
      subject: job.data.title,
    });
  }
}
