import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorType,
  PaymentLifecycleStatus,
  PaymentStatus,
  RefundStatus,
  type WalletOwnerType,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { kesFromBigInt, kesToBigInt } from '../../../shared/money';
import type { PaymentEvent } from '../../payments/domain/payment';
import {
  InvalidJournalLineError,
  UnbalancedJournalError,
} from '../domain/journal';
import type { PaymentAllocationHint } from '../domain/posting-rules';
import {
  resolvePaymentPostingLines,
  resolveRefundPostingLines,
  resolveSettlementPayoutLines,
  resolveEscrowReleaseLines,
} from '../domain/posting-rules';
import { JournalService } from './journal.service';
import {
  journalEntryInclude,
  toJournalView,
} from './journal-persistence.util';

@Injectable()
export class PostingEngineService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly journals: JournalService,
    private readonly events: EventEmitter2,
  ) {}

  public async postPaymentCollected(
    paymentIdOrEvent: string | PaymentEvent,
  ) {
    const paymentId =
      typeof paymentIdOrEvent === 'string'
        ? paymentIdOrEvent
        : paymentIdOrEvent.aggregateId ||
          (typeof paymentIdOrEvent.payload.paymentId === 'string'
            ? paymentIdOrEvent.payload.paymentId
            : null);

    if (!paymentId) {
      throw new BadRequestException('paymentId is required');
    }

    const existing = await this.prisma.journalEntry.findUnique({
      where: { paymentId },
      include: journalEntryInclude(),
    });
    if (existing) {
      return {
        success: true as const,
        journal: toJournalView(existing),
        idempotent: true,
      };
    }

    const posted = await this.prisma.$transaction(async (tx) => {
      const again = await tx.journalEntry.findUnique({
        where: { paymentId },
        include: journalEntryInclude(),
      });
      if (again) return { entry: again, idempotent: true };

      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { allocations: true },
      });
      if (!payment) {
        throw new NotFoundException(`Payment ${paymentId} not found`);
      }

      const success =
        payment.status === PaymentStatus.SUCCESS ||
        payment.lifecycleStatus === PaymentLifecycleStatus.SUCCEEDED;
      if (!success) {
        throw new BadRequestException(
          `Payment ${paymentId} is not SUCCESS/SUCCEEDED (status=${payment.status}, lifecycle=${payment.lifecycleStatus})`,
        );
      }

      let draft;
      try {
        draft = resolvePaymentPostingLines({
          purpose: payment.purpose,
          amount: payment.amount,
          currency: payment.currency,
          description: `Payment ${payment.reference ?? payment.id}`,
          allocations: payment.allocations.map((a) => ({
            amount: a.amount,
            accountCodeHint: a.accountCodeHint,
            label: a.label,
          })),
        });
      } catch (error) {
        if (
          error instanceof UnbalancedJournalError ||
          error instanceof InvalidJournalLineError
        ) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }

      const valueDate = payment.completedAt ?? payment.updatedAt ?? new Date();
      const entry = await this.journals.postDraftLinesInTx(tx, {
        draft,
        valueDate,
        paymentId: payment.id,
        description: draft.description,
        actorType: ActorType.SYSTEM,
      });
      return { entry, idempotent: false };
    });

    if (!posted.idempotent) {
      this.events.emit('accounting.JournalPosted', {
        journalId: posted.entry.id,
        entryNumber: posted.entry.entryNumber,
        paymentId,
        at: new Date().toISOString(),
      });
    }

    return {
      success: true as const,
      journal: toJournalView(posted.entry),
      idempotent: posted.idempotent,
    };
  }

  /**
   * Post the unwind journal for a SUCCEEDED refund. Idempotent via
   * `Refund.journalEntryId`. Never sets `paymentId` on the journal
   * (unique constraint) — uses `externalRef: refund:{id}` instead.
   */
  public async postPaymentRefunded(refundIdOrEvent: string | PaymentEvent) {
    const refundId =
      typeof refundIdOrEvent === 'string'
        ? refundIdOrEvent
        : typeof refundIdOrEvent.payload.refundId === 'string'
          ? refundIdOrEvent.payload.refundId
          : null;

    if (!refundId) {
      throw new BadRequestException('refundId is required');
    }

    const existingRefund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });
    if (!existingRefund) {
      throw new NotFoundException(`Refund ${refundId} not found`);
    }
    if (existingRefund.journalEntryId) {
      const existing = await this.prisma.journalEntry.findUnique({
        where: { id: existingRefund.journalEntryId },
        include: journalEntryInclude(),
      });
      if (existing) {
        return {
          success: true as const,
          journal: toJournalView(existing),
          idempotent: true,
        };
      }
    }
    if (existingRefund.status !== RefundStatus.SUCCEEDED) {
      throw new BadRequestException(
        `Refund ${refundId} is not SUCCEEDED (status=${existingRefund.status})`,
      );
    }

    const posted = await this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.findUnique({ where: { id: refundId } });
      if (!refund) {
        throw new NotFoundException(`Refund ${refundId} not found`);
      }
      if (refund.journalEntryId) {
        const again = await tx.journalEntry.findUnique({
          where: { id: refund.journalEntryId },
          include: journalEntryInclude(),
        });
        if (again) {
          return { entry: again, idempotent: true, paymentId: refund.paymentId };
        }
      }

      const payment = await tx.payment.findUnique({
        where: { id: refund.paymentId },
        include: { allocations: true },
      });
      if (!payment) {
        throw new NotFoundException(`Payment ${refund.paymentId} not found`);
      }

      let allocationsForRefund: PaymentAllocationHint[] | undefined;
      if (payment.allocations.length > 0 && payment.amount > 0n) {
        if (refund.amount === payment.amount) {
          allocationsForRefund = payment.allocations.map((a) => ({
            amount: a.amount,
            accountCodeHint: a.accountCodeHint,
            label: a.label,
          }));
        } else {
          const refundMoney = kesFromBigInt(refund.amount);
          const ratios = payment.allocations.map((a) => Number(a.amount));
          const shares = refundMoney.allocate(ratios);
          allocationsForRefund = payment.allocations.map((a, index) => ({
            amount: kesToBigInt(shares[index]),
            accountCodeHint: a.accountCodeHint,
            label: a.label,
          }));
        }
      }

      let draft;
      try {
        draft = resolveRefundPostingLines({
          purpose: payment.purpose,
          amount: refund.amount,
          currency: refund.currency,
          description: `Refund ${refund.id} for payment ${payment.reference ?? payment.id}`,
          allocations: allocationsForRefund,
        });
      } catch (error) {
        if (
          error instanceof UnbalancedJournalError ||
          error instanceof InvalidJournalLineError
        ) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }

      const valueDate = refund.completedAt ?? refund.updatedAt ?? new Date();
      const entry = await this.journals.postDraftLinesInTx(tx, {
        draft,
        valueDate,
        externalRef: `refund:${refund.id}`,
        description: draft.description,
        actorType: ActorType.SYSTEM,
      });

      await tx.refund.update({
        where: { id: refund.id },
        data: { journalEntryId: entry.id },
      });

      return { entry, idempotent: false, paymentId: refund.paymentId };
    });

    if (!posted.idempotent) {
      this.events.emit('accounting.JournalPosted', {
        journalId: posted.entry.id,
        entryNumber: posted.entry.entryNumber,
        paymentId: posted.paymentId,
        refundId,
        purpose: 'REFUND',
        at: new Date().toISOString(),
      });
    }

    return {
      success: true as const,
      journal: toJournalView(posted.entry),
      idempotent: posted.idempotent,
    };
  }

  /**
   * Post a settlement batch item payout journal. Idempotent via
   * `Settlement.journalEntryId`. Uses `externalRef: settlement:{id}` — never
   * sets `paymentId` (settlements are not tied to a single payment).
   */
  public async postSettlementPayout(input: {
    readonly settlementId: string;
    readonly beneficiaryType: WalletOwnerType | string;
    readonly amount: bigint;
    readonly currency?: string;
    readonly description?: string;
  }) {
    const existing = await this.prisma.settlement.findUnique({
      where: { id: input.settlementId },
    });
    if (!existing) {
      throw new NotFoundException(`Settlement ${input.settlementId} not found`);
    }
    if (existing.journalEntryId) {
      const journal = await this.prisma.journalEntry.findUnique({
        where: { id: existing.journalEntryId },
        include: journalEntryInclude(),
      });
      if (journal) {
        return { success: true as const, journal: toJournalView(journal), idempotent: true };
      }
    }

    const posted = await this.prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.findUnique({
        where: { id: input.settlementId },
      });
      if (!settlement) {
        throw new NotFoundException(`Settlement ${input.settlementId} not found`);
      }
      if (settlement.journalEntryId) {
        const again = await tx.journalEntry.findUnique({
          where: { id: settlement.journalEntryId },
          include: journalEntryInclude(),
        });
        if (again) return { entry: again, idempotent: true };
      }

      let draft;
      try {
        draft = resolveSettlementPayoutLines({
          beneficiaryType: input.beneficiaryType,
          amount: input.amount,
          currency: input.currency ?? settlement.currency,
          description: input.description,
        });
      } catch (error) {
        if (
          error instanceof UnbalancedJournalError ||
          error instanceof InvalidJournalLineError
        ) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }

      const entry = await this.journals.postDraftLinesInTx(tx, {
        draft,
        valueDate: new Date(),
        externalRef: `settlement:${settlement.id}`,
        description: draft.description,
        actorType: ActorType.SYSTEM,
      });

      await tx.settlement.update({
        where: { id: settlement.id },
        data: { journalEntryId: entry.id },
      });

      return { entry, idempotent: false };
    });

    if (!posted.idempotent) {
      this.events.emit('accounting.JournalPosted', {
        journalId: posted.entry.id,
        entryNumber: posted.entry.entryNumber,
        settlementId: input.settlementId,
        purpose: 'SETTLEMENT',
        at: new Date().toISOString(),
      });
    }

    return {
      success: true as const,
      journal: toJournalView(posted.entry),
      idempotent: posted.idempotent,
    };
  }

  /**
   * Post escrow → payable transfer on release. Idempotent via
   * `externalRef: escrow-release:{escrowId}`.
   */
  public async postEscrowRelease(input: {
    readonly escrowId: string;
    readonly beneficiaryType: WalletOwnerType | string;
    readonly amount: bigint;
    readonly currency?: string;
    readonly purpose?: string | null;
    readonly description?: string;
  }) {
    const externalRef = `escrow-release:${input.escrowId}`;
    const existing = await this.prisma.journalEntry.findFirst({
      where: { externalRef },
      include: journalEntryInclude(),
    });
    if (existing) {
      return {
        success: true as const,
        journal: toJournalView(existing),
        idempotent: true as const,
      };
    }

    const posted = await this.prisma.$transaction(async (tx) => {
      const again = await tx.journalEntry.findFirst({
        where: { externalRef },
        include: journalEntryInclude(),
      });
      if (again) return { entry: again, idempotent: true as const };

      let draft;
      try {
        draft = resolveEscrowReleaseLines({
          beneficiaryType: input.beneficiaryType,
          purpose: input.purpose,
          amount: input.amount,
          currency: input.currency,
          description: input.description,
        });
      } catch (error) {
        if (
          error instanceof UnbalancedJournalError ||
          error instanceof InvalidJournalLineError
        ) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }

      const entry = await this.journals.postDraftLinesInTx(tx, {
        draft,
        valueDate: new Date(),
        externalRef,
        description: draft.description,
        actorType: ActorType.SYSTEM,
      });
      return { entry, idempotent: false as const };
    });

    return {
      success: true as const,
      journal: toJournalView(posted.entry),
      idempotent: posted.idempotent,
    };
  }
}
