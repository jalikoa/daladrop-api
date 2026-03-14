import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class NotificationListener {
  constructor(@InjectQueue('notification-events') private readonly notificationQueue: Queue) {}

  @OnEvent('user.created')
  async handleUserCreated(payload: { userId: number; email: string | null }) {
    if (payload.email) {
      await this.notificationQueue.add('send.email', {
        email: payload.email,
        subject: 'Welcome to NFC Payment System',
        body: '<h1>Welcome!</h1><p>Your account has been created.</p>',
      });
    }
  }

  @OnEvent('payment.completed')
  async handlePaymentCompleted(payload: {
    merchantId: number;
    merchantPhone: string;
    merchantEmail?: string;
    amount: number;
    receipt: string;
  }) {
    // SMS
    await this.notificationQueue.add('send.sms', {
      phone: payload.merchantPhone,
      message: `Payment received: KES ${payload.amount}. Receipt: ${payload.receipt}`,
    });

    // Email
    if (payload.merchantEmail) {
      await this.notificationQueue.add('send.email', {
        email: payload.merchantEmail,
        subject: 'Payment Received',
        body: `<p>Payment of KES ${payload.amount} received. Receipt: ${payload.receipt}</p>`,
      });
    }
  }
}
