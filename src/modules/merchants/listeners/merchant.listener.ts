import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { MERCHANT_CONSTANTS } from '../constants/merchant.constants';
import { MerchantCreatedEvent, MerchantPaymentLinkGeneratedEvent } from '../events/merchant.events';

@Injectable()
export class MerchantListener {
  private readonly logger = new Logger(MerchantListener.name);

  constructor(
    @InjectQueue('notification-events') private readonly notificationQueue: Queue,
    @InjectQueue('audit-queue') private readonly auditQueue: Queue,
  ) {}

  @OnEvent(MERCHANT_CONSTANTS.EVENTS.CREATED)
  async handleMerchantCreated(event: MerchantCreatedEvent) {
    this.logger.log(`Merchant created: ${event.businessName} (ID: ${event.merchantId})`);

    await this.notificationQueue.add('send.email', {
      subject: 'Welcome to NFC Payment Platform',
      body: `<p>Your merchant account "${event.businessName}" has been created.</p>`,
    });

    await this.auditQueue.add('log.action', {
      userId: event.userId,
      action: 'MERCHANT_CREATED',
      payload: { merchantId: event.merchantId, businessName: event.businessName },
    });
  }

  @OnEvent(MERCHANT_CONSTANTS.EVENTS.PAYMENT_LINK_GENERATED)
  async handlePaymentLinkGenerated(event: MerchantPaymentLinkGeneratedEvent) {
    this.logger.log(`Payment link generated for merchant ${event.merchantId}`);

    await this.auditQueue.add('log.action', {
      userId: event.userId,
      action: 'PAYMENT_LINK_GENERATED',
      payload: { 
        merchantId: event.merchantId, 
        encryptedToken: event.encryptedToken.substring(0, 20) + '...',
      },
    });
  }
}
