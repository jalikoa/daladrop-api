import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { NFC_CONSTANTS } from '../constants/nfc.constants';
import { NfcPaymentSessionStartedEvent } from '../events/nfc.events';

@Injectable()
export class NfcListener {
  private readonly logger = new Logger(NfcListener.name);

  constructor(
    @InjectQueue('payments-queue') private readonly paymentsQueue: Queue,
    @InjectQueue('audit-queue') private readonly auditQueue: Queue,
  ) {}

  @OnEvent(NFC_CONSTANTS.EVENTS.PAYMENT_SESSION_STARTED)
  async handlePaymentSessionStarted(event: NfcPaymentSessionStartedEvent) {
    this.logger.log(`Payment session started: ${event.sessionUuid} for merchant ${event.merchantId}`);

    await this.paymentsQueue.add('session.create', {
      sessionUuid: event.sessionUuid,
      merchantId: event.merchantId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      timestamp: event.timestamp,
    });

    await this.auditQueue.add('log.action', {
      userId: event.userId,
      action: 'NFC_PAYMENT_SESSION_STARTED',
      payload: {
        sessionUuid: event.sessionUuid,
        merchantId: event.merchantId,
        ipAddress: event.ipAddress,
      },
    });
  }
}
