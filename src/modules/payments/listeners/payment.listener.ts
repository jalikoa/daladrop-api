import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

import { Account } from '../../ledger/entities/account.entity';
import { LedgerEntry } from '../../ledger/entities/ledger-entry.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { MerchantProfile } from '../../merchants/entities/merchant-profile.entity';
import { NotificationChannel, NotificationStatus } from '../../notifications/enums/notification-channel.enum';
import { PAYMENT_CONSTANTS } from '../constants/payment.constants';
import {
  PaymentSessionCreatedEvent,
  PaymentInitiatedEvent,
  PaymentCompletedEvent,
  PaymentFailedEvent,
} from '../events/payment.events';

@Injectable()
export class PaymentListener {
  private readonly logger = new Logger(PaymentListener.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerEntryRepo: Repository<LedgerEntry>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(MerchantProfile)
    private readonly merchantRepo: Repository<MerchantProfile>,
    @InjectQueue(PAYMENT_CONSTANTS.QUEUE.NAME)
    private readonly paymentQueue: Queue,
    @InjectQueue('audit-queue')
    private readonly auditQueue: Queue,
  ) {}

  // ── session.created ──────────────────────────────────────────────────────
  @OnEvent(PAYMENT_CONSTANTS.EVENTS.SESSION_CREATED)
  async handleSessionCreated(event: PaymentSessionCreatedEvent): Promise<void> {
    this.logger.log(`Payment session created: ${event.sessionUuid}`);
    await this.auditQueue.add('log.action', {
      action: 'PAYMENT_SESSION_CREATED',
      payload: { sessionUuid: event.sessionUuid, merchantId: event.merchantId, amount: event.amount },
    });
  }

  // ── payment.initiated ────────────────────────────────────────────────────
  @OnEvent(PAYMENT_CONSTANTS.EVENTS.INITIATED)
  async handlePaymentInitiated(event: PaymentInitiatedEvent): Promise<void> {
    this.logger.log(`Payment initiated: ${event.sessionUuid}`);

    // Schedule a timeout check in case Daraja never sends a callback
    await this.paymentQueue.add(
      'payment.timeout.check',
      {
        paymentId: event.paymentId,
        checkoutRequestId: event.checkoutRequestId,
        timeoutAt: Date.now() + PAYMENT_CONSTANTS.STK.TIMEOUT_SECONDS * 1000,
      },
      { delay: PAYMENT_CONSTANTS.STK.TIMEOUT_SECONDS * 1000 },
    );

    await this.auditQueue.add('log.action', {
      action: 'PAYMENT_INITIATED',
      payload: {
        paymentId: event.paymentId,
        checkoutRequestId: event.checkoutRequestId,
        amount: event.amount,
      },
    });
  }

  // ── payment.completed ────────────────────────────────────────────────────
  // NOTE: By the time this fires, HandleCallbackUseCase has ALREADY:
  //   • updated payment_sessions.status = COMPLETED
  //   • saved the payment_callbacks row
  // This handler only does the NEW work: ledger entries + notification + audit
  @OnEvent(PAYMENT_CONSTANTS.EVENTS.COMPLETED)
  async handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    this.logger.log(`Payment completed: ${event.sessionUuid} — receipt: ${event.receipt}`);

    try {
      // ── 1. Double-entry ledger ──────────────────────────────────────────
      const [clearingAccount, merchantWallet] = await Promise.all([
        this.accountRepo.findOne({ where: { name: 'M-Pesa Clearing' } }),
        this.accountRepo.findOne({ where: { name: 'Merchant Wallets' } }),
      ]);

      if (clearingAccount && merchantWallet) {
        const txRef   = event.receipt;
        const amount  = String(event.amount);
        const meta    = {
          payment_session_id: event.paymentId,
          merchant_id:        event.merchantId,
          customer_phone:     event.customerPhone,
          receipt:            event.receipt,
        };

        await this.ledgerEntryRepo.save(
          this.ledgerEntryRepo.create({
            transactionId: txRef,
            accountId:     clearingAccount.id,   // already number now
            type:          'DEBIT' as const,     // ← uppercase to match DB enum
            amount,
            metadata: meta,
          }),
        );

        // CREDIT
        await this.ledgerEntryRepo.save(
          this.ledgerEntryRepo.create({
            transactionId: txRef,
            accountId:     merchantWallet.id,    // already number now
            type:          'CREDIT' as const,    // ← uppercase
            amount,
            metadata: meta,
          }),
        );

        // Update running balance
        merchantWallet.balance = String(
          Number(merchantWallet.balance ?? '0') + Number(event.amount),
        );
        await this.accountRepo.save(merchantWallet);

        this.logger.log(`Ledger entries created for receipt ${event.receipt}`);
      } else {
        this.logger.warn('Ledger accounts not found — skipping double-entry');
      }

      // ── 2. SMS receipt notification ─────────────────────────────────────
      const merchant = await this.merchantRepo.findOne({ where: { id: event.merchantId } });

      await this.notificationRepo.save(
        this.notificationRepo.create({
          user_id:   merchant?.user_id ?? null,
          channel:   NotificationChannel.SMS,
          recipient: event.customerPhone,
          message:   `Payment received: KES ${event.amount}. Receipt: ${event.receipt}`,
          status:    NotificationStatus.QUEUED,
          provider:  'africastalking',
        }),
      );

      // ── 3. Audit ────────────────────────────────────────────────────────
      await this.auditQueue.add('log.action', {
        action: 'PAYMENT_COMPLETED',
        payload: { paymentId: event.paymentId, receipt: event.receipt, amount: event.amount },
      });

      this.logger.log(`Post-completion tasks done for payment ${event.receipt}`);

    } catch (error) {
      // Log but do not re-throw — the payment itself succeeded,
      // a ledger/notification failure should not surface to the webhook caller
      this.logger.error(
        `Post-completion tasks failed for ${event.sessionUuid}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  // ── payment.failed ───────────────────────────────────────────────────────
  // NOTE: HandleCallbackUseCase has already updated the session to FAILED/CANCELLED
  // and saved the callback. This handler only does the audit entry.
  @OnEvent(PAYMENT_CONSTANTS.EVENTS.FAILED)
  async handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
    this.logger.warn(`Payment failed: ${event.sessionUuid} — ${event.reason}`);

    try {
      await this.auditQueue.add('log.action', {
        action: event.code === '1032' ? 'PAYMENT_CANCELLED' : 'PAYMENT_FAILED',
        payload: { paymentId: event.paymentId, reason: event.reason, code: event.code },
      });
    } catch (error) {
      this.logger.error(
        `Audit log failed for payment.failed ${event.sessionUuid}`,
        (error as Error).stack,
      );
    }
  }
}