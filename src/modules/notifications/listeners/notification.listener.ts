import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { NOTIFICATION_CONSTANTS } from '../constants/notification.constants';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(@InjectQueue(NOTIFICATION_CONSTANTS.QUEUE.NAME) private readonly notificationQueue: Queue) {}

  @OnEvent('user.created')
  async handleUserCreated(payload: { userId: number; email: string | null }) {
    this.logger.log(`Handling user.created event for user ${payload.userId}`);
    
    if (payload.email) {
      this.logger.log(`Queuing welcome email to ${payload.email}`);
      await this.notificationQueue.add('send.email', {
        email: payload.email,
        subject: 'Welcome to TapPay',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif;">
              <h2 style="color: #4cca5a;">Welcome to TapPay!</h2>
              <p>Your account has been created successfully.</p>
              <p>Get started by setting up your merchant profile and generating your NFC payment card.</p>
              <p style="color: #666; font-size: 14px; margin-top: 20px;">Thank you for choosing TapPay!</p>
            </body>
          </html>
        `,
      });
    } else {
      this.logger.warn(`User ${payload.userId} has no email address. Skipping welcome email.`);
    }
  }
}
