import { Injectable, Logger } from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { kesFromBigInt } from '../../../shared/money';
import { EscrowService } from './escrow.service';
import { WalletService } from './wallet.service';

const REFUND_EXTERNAL_REF_PREFIX = 'refund:';

/** Payload emitted by accounting posting engine / journal service. */
export interface JournalPostedEvent {
  readonly journalId: string;
  readonly entryNumber?: string;
  readonly paymentId?: string | null;
  readonly refundId?: string | null;
  readonly purpose?: string;
  readonly at?: string;
}

/**
 * Mirrors posted payment journals into liability wallets / escrow holds.
 * Prefer JournalPosted (has journalId) over PaymentCompleted.
 */
@Injectable()
export class WalletMirroringService {
  private readonly logger = new Logger(WalletMirroringService.name);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
    private readonly escrow: EscrowService,
  ) {}

  public async mirrorJournalPosted(event: JournalPostedEvent): Promise<void> {
    const journalId = event.journalId;
    if (!journalId) {
      this.logger.warn('JournalPosted without journalId — skipping wallet mirror');
      return;
    }

    const journal = await this.prisma.journalEntry.findUnique({
      where: { id: journalId },
    });
    if (!journal) {
      this.logger.warn(`Journal ${journalId} not found — skipping wallet mirror`);
      return;
    }

    const refundId =
      event.refundId ??
      (journal.externalRef?.startsWith(REFUND_EXTERNAL_REF_PREFIX)
        ? journal.externalRef.slice(REFUND_EXTERNAL_REF_PREFIX.length)
        : null);
    if (refundId) {
      await this.mirrorRefund(refundId, journalId);
      return;
    }

    const paymentId = event.paymentId ?? journal.paymentId;
    if (!paymentId) {
      this.logger.debug(
        `Journal ${journal.entryNumber} has no paymentId — no wallet mirror`,
      );
      return;
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      this.logger.warn(
        `Payment ${paymentId} missing for journal ${journalId} — skip`,
      );
      return;
    }

    if (payment.purpose === 'WALLET_TOP_UP') {
      await this.mirrorWalletTopUp(payment.id, journalId, payment.customerId, payment.amount, payment.currency);
      return;
    }

    if (
      payment.purpose === 'SETTLEMENT' ||
      payment.purpose === 'REFUND'
    ) {
      this.logger.debug(
        `Payment ${paymentId} purpose ${payment.purpose} — no escrow mirror`,
      );
      return;
    }

    await this.escrow.ensureHoldForPayment({
      paymentId: payment.id,
      journalEntryId: journalId,
      actorId: null,
    });
  }

  /**
   * Unwinds the liability created for a refunded payment.
   * WALLET_TOP_UP payments debit the customer wallet directly; everything
   * else unholds the payment's escrow (fully or partially) via EscrowService.
   */
  private async mirrorRefund(refundId: string, journalEntryId: string): Promise<void> {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) {
      this.logger.warn(`Refund ${refundId} not found — skipping wallet mirror`);
      return;
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: refund.paymentId },
    });
    if (!payment) {
      this.logger.warn(
        `Payment ${refund.paymentId} missing for refund ${refundId} — skip`,
      );
      return;
    }

    if (payment.purpose === 'WALLET_TOP_UP') {
      if (!payment.customerId) {
        this.logger.warn(
          `WALLET_TOP_UP payment ${payment.id} has no customerId — skip refund ${refundId}`,
        );
        return;
      }
      const wallet = await this.wallets.getOrCreate(
        'CUSTOMER',
        payment.customerId,
        refund.currency,
      );
      const reference = `refund:${refundId}`;
      const existing = await this.prisma.walletTransaction.findFirst({
        where: { walletId: wallet.id, reference },
      });
      if (existing) {
        this.logger.debug(`Refund ${refundId} already mirrored (txn ${existing.id})`);
        return;
      }
      await this.wallets.debit(wallet.id, kesFromBigInt(refund.amount), {
        actorType: ActorType.SYSTEM,
        paymentId: payment.id,
        journalEntryId,
        reference,
        description: `Wallet debit for refund ${refundId}`,
        idempotencyKey: `refund:${refundId}`,
      });
      return;
    }

    await this.escrow.refundForPayment({
      paymentId: payment.id,
      amount: refund.amount,
      refundId,
      journalEntryId,
    });
  }

  private async mirrorWalletTopUp(
    paymentId: string,
    journalEntryId: string,
    customerId: string | null,
    amount: bigint,
    currency: string,
  ): Promise<void> {
    if (!customerId) {
      this.logger.warn(
        `WALLET_TOP_UP payment ${paymentId} has no customerId — skip`,
      );
      return;
    }

    const wallet = await this.wallets.getOrCreate(
      'CUSTOMER',
      customerId,
      currency,
    );

    const existing = await this.prisma.walletTransaction.findFirst({
      where: {
        walletId: wallet.id,
        paymentId,
        journalEntryId,
        type: 'CREDIT',
      },
    });
    if (existing) {
      this.logger.debug(
        `Top-up already mirrored for payment ${paymentId} (txn ${existing.id})`,
      );
      return;
    }

    await this.wallets.credit(wallet.id, kesFromBigInt(amount), {
      actorType: ActorType.SYSTEM,
      paymentId,
      journalEntryId,
      reference: `topup:${paymentId}`,
      description: `Wallet top-up from payment ${paymentId}`,
      idempotencyKey: `topup:${paymentId}:${journalEntryId}`,
    });
  }
}
