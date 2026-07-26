import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorType,
  AuditAction,
  EscrowStatus,
  Prisma,
  WalletOwnerType,
  type EscrowHold,
  type Payment,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { kesFromBigInt, kesToBigInt } from '../../../shared/money';
import { PostingEngineService } from '../../accounting/use-cases/posting-engine.service';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';
import { platformWalletOwnerId } from '../constants/platform-wallet';
import { snapshotFromBigInt } from '../domain/wallet-balance';
import {
  applyHold,
  applyRelease,
  applyUnhold,
  InsufficientHeldError,
  InvalidWalletAmountError,
} from '../domain/wallet-ops';
import { WalletService, type TxClient } from './wallet.service';

export interface BeneficiaryResolution {
  readonly beneficiaryType: WalletOwnerType;
  readonly beneficiaryId: string;
}

function toEscrowView(row: EscrowHold) {
  return {
    id: row.id,
    paymentId: row.paymentId,
    orderId: row.orderId,
    rideId: row.rideId,
    status: row.status,
    amount: Number(row.amount),
    currency: row.currency,
    beneficiaryType: row.beneficiaryType,
    beneficiaryId: row.beneficiaryId,
    heldAt: row.heldAt.toISOString(),
    releasedAt: row.releasedAt?.toISOString() ?? null,
    journalEntryId: row.journalEntryId,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
    private readonly audit: AuditLogService,
    private readonly events: EventEmitter2,
    private readonly postingEngine: PostingEngineService,
  ) {}

  public async list(query: {
    status?: EscrowStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Prisma.EscrowHoldWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.escrowHold.count({ where }),
      this.prisma.escrowHold.findMany({
        where,
        orderBy: { heldAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      success: true as const,
      items: rows.map(toEscrowView),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  public async getById(id: string) {
    const row = await this.prisma.escrowHold.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Escrow hold not found');
    }
    return { success: true as const, escrow: toEscrowView(row) };
  }

  /**
   * Resolve who should receive escrow liability for a payment purpose.
   * Falls back to PLATFORM when the domain owner cannot be resolved.
   */
  public async resolveBeneficiary(
    payment: Payment,
  ): Promise<BeneficiaryResolution> {
    const platform: BeneficiaryResolution = {
      beneficiaryType: WalletOwnerType.PLATFORM,
      beneficiaryId: platformWalletOwnerId(),
    };

    switch (payment.purpose) {
      case 'ORDER': {
        if (!payment.orderId) {
          return platform;
        }
        const order = await this.prisma.order.findUnique({
          where: { id: payment.orderId },
          select: { store: { select: { merchantId: true } } },
        });
        const merchantId = order?.store?.merchantId;
        if (!merchantId) {
          return platform;
        }
        return {
          beneficiaryType: WalletOwnerType.MERCHANT,
          beneficiaryId: merchantId,
        };
      }
      case 'RIDE': {
        if (!payment.rideId) {
          return platform;
        }
        const ride = await this.prisma.ride.findUnique({
          where: { id: payment.rideId },
          select: { riderId: true },
        });
        if (!ride?.riderId) {
          return platform;
        }
        return {
          beneficiaryType: WalletOwnerType.RIDER,
          beneficiaryId: ride.riderId,
        };
      }
      case 'EVENT_BOOKING': {
        if (!payment.eventBookingId) {
          return platform;
        }
        const booking = await this.prisma.eventBooking.findUnique({
          where: { id: payment.eventBookingId },
          select: {
            event: {
              select: { organizerId: true, merchantId: true },
            },
          },
        });
        const organizerId = booking?.event?.organizerId;
        if (organizerId) {
          return {
            beneficiaryType: WalletOwnerType.ORGANIZER,
            beneficiaryId: organizerId,
          };
        }
        const merchantId = booking?.event?.merchantId;
        if (merchantId) {
          return {
            beneficiaryType: WalletOwnerType.MERCHANT,
            beneficiaryId: merchantId,
          };
        }
        return platform;
      }
      case 'WALLET_TOP_UP': {
        if (!payment.customerId) {
          return platform;
        }
        return {
          beneficiaryType: WalletOwnerType.CUSTOMER,
          beneficiaryId: payment.customerId,
        };
      }
      default:
        return platform;
    }
  }

  /**
   * Idempotent: returns existing hold for paymentId, otherwise creates
   * EscrowHold + external HOLD on the beneficiary wallet.
   */
  public async ensureHoldForPayment(input: {
    readonly paymentId: string;
    readonly journalEntryId?: string | null;
    readonly actorId?: string | null;
  }) {
    const existing = await this.prisma.escrowHold.findFirst({
      where: { paymentId: input.paymentId },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      return {
        success: true as const,
        idempotent: true as const,
        escrow: toEscrowView(existing),
      };
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: input.paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const beneficiary = await this.resolveBeneficiary(payment);
    const wallet = await this.wallets.getOrCreate(
      beneficiary.beneficiaryType,
      beneficiary.beneficiaryId,
      payment.currency,
    );
    const money = kesFromBigInt(payment.amount);

    const created = await this.prisma.$transaction(async (tx) => {
      const raced = await tx.escrowHold.findFirst({
        where: { paymentId: payment.id },
        orderBy: { createdAt: 'asc' },
      });
      if (raced) {
        return { escrow: raced, walletTxnId: null as string | null };
      }

      const fresh = await this.wallets.loadForUpdate(tx, wallet.id);
      let op;
      try {
        op = applyHold(snapshotFromBigInt(fresh.balanceAmount, fresh.holdAmount, fresh.version), money, {
          fromExternal: true,
        });
      } catch (error) {
        if (
          error instanceof InvalidWalletAmountError ||
          error instanceof InsufficientHeldError
        ) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }

      const applied = await this.wallets.applyInTx(tx, fresh, op, {
        actorId: input.actorId,
        actorType: ActorType.SYSTEM,
        paymentId: payment.id,
        journalEntryId: input.journalEntryId ?? null,
        reference: `escrow:${payment.id}`,
        description: `Escrow hold for payment ${payment.reference ?? payment.id}`,
      });

      const escrow = await tx.escrowHold.create({
        data: {
          paymentId: payment.id,
          orderId: payment.orderId,
          rideId: payment.rideId,
          status: EscrowStatus.HELD,
          amount: payment.amount,
          currency: payment.currency,
          beneficiaryType: beneficiary.beneficiaryType,
          beneficiaryId: beneficiary.beneficiaryId,
          journalEntryId: input.journalEntryId ?? null,
        },
      });

      return { escrow, walletTxnId: applied.transaction.id };
    });

    if (created.walletTxnId) {
      await this.audit.record({
        tableName: 'escrow_holds',
        recordId: created.escrow.id,
        action: AuditAction.INSERT,
        actorId: input.actorId,
        actorType: ActorType.SYSTEM,
        afterData: toEscrowView(created.escrow),
        reason: 'escrow hold created from journal post',
      });
    }

    return {
      success: true as const,
      idempotent: created.walletTxnId == null,
      escrow: toEscrowView(created.escrow),
    };
  }

  public async release(
    escrowId: string,
    meta: {
      readonly actorId: string;
      readonly idempotencyKey?: string | null;
      readonly reason?: string | null;
    },
  ) {
    return this.closeEscrow(escrowId, EscrowStatus.RELEASED, meta, 'release');
  }

  public async forfeit(
    escrowId: string,
    meta: {
      readonly actorId: string;
      readonly idempotencyKey?: string | null;
      readonly reason?: string | null;
    },
  ) {
    return this.closeEscrow(escrowId, EscrowStatus.FORFEITED, meta, 'forfeit');
  }

  public async refund(
    escrowId: string,
    meta: {
      readonly actorId: string;
      readonly idempotencyKey?: string | null;
      readonly reason?: string | null;
    },
  ) {
    return this.closeEscrow(escrowId, EscrowStatus.REFUNDED, meta, 'refund');
  }

  /**
   * Unwind a HELD escrow for a partial or full payment refund.
   * Idempotent on the wallet transaction reference `refund:{refundId}`.
   * If `amount` >= the escrow's remaining amount the hold is closed to
   * REFUNDED; otherwise the hold amount is reduced by `amount` and it stays
   * HELD for the remainder.
   */
  public async refundForPayment(input: {
    readonly paymentId: string;
    readonly amount: bigint;
    readonly refundId: string;
    readonly journalEntryId?: string | null;
  }) {
    const reference = `refund:${input.refundId}`;

    const existingTxn = await this.prisma.walletTransaction.findFirst({
      where: { reference },
    });
    if (existingTxn) {
      return { success: true as const, idempotent: true as const, escrow: null };
    }

    const escrow = await this.prisma.escrowHold.findFirst({
      where: { paymentId: input.paymentId, status: EscrowStatus.HELD },
      orderBy: { createdAt: 'asc' },
    });
    if (!escrow) {
      this.logger.debug(
        `No HELD escrow for payment ${input.paymentId} — nothing to unwind for refund ${input.refundId}`,
      );
      return { success: true as const, idempotent: true as const, escrow: null };
    }
    if (!escrow.beneficiaryId) {
      throw new BadRequestException('Escrow hold has no beneficiaryId');
    }

    const wallet = await this.wallets.getOrCreate(
      escrow.beneficiaryType,
      escrow.beneficiaryId,
      escrow.currency,
    );
    const refundMoney = kesFromBigInt(input.amount);
    const escrowMoney = kesFromBigInt(escrow.amount);
    const isFull = refundMoney.compareTo(escrowMoney) >= 0;
    const unholdMoney = isFull ? escrowMoney : refundMoney;

    const result = await this.prisma.$transaction(async (tx: TxClient) => {
      const freshEscrow = await tx.escrowHold.findUnique({
        where: { id: escrow.id },
      });
      if (!freshEscrow || freshEscrow.status !== EscrowStatus.HELD) {
        throw new BadRequestException('Escrow hold is no longer HELD');
      }

      const freshWallet = await this.wallets.loadForUpdate(tx, wallet.id);
      const snapshot = snapshotFromBigInt(
        freshWallet.balanceAmount,
        freshWallet.holdAmount,
        freshWallet.version,
      );
      let op;
      try {
        op = applyUnhold(snapshot, unholdMoney);
      } catch (error) {
        if (
          error instanceof InvalidWalletAmountError ||
          error instanceof InsufficientHeldError
        ) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }

      const applied = await this.wallets.applyInTx(tx, freshWallet, op, {
        actorId: null,
        actorType: ActorType.SYSTEM,
        paymentId: input.paymentId,
        journalEntryId: input.journalEntryId ?? freshEscrow.journalEntryId,
        reference,
        description: `Escrow refund ${input.refundId} (${kesToBigInt(unholdMoney)} ${freshEscrow.currency})`,
      });

      const updated = isFull
        ? await tx.escrowHold.update({
            where: { id: escrow.id },
            data: { status: EscrowStatus.REFUNDED, releasedAt: new Date() },
          })
        : await tx.escrowHold.update({
            where: { id: escrow.id },
            data: { amount: freshEscrow.amount - kesToBigInt(unholdMoney) },
          });

      return { escrow: updated, transaction: applied.transaction, walletId: wallet.id };
    });

    await this.audit.record({
      tableName: 'escrow_holds',
      recordId: escrow.id,
      action: AuditAction.STATUS_CHANGE,
      actorId: null,
      actorType: ActorType.SYSTEM,
      beforeData: { status: EscrowStatus.HELD, amount: escrow.amount.toString() },
      afterData: {
        status: result.escrow.status,
        amount: result.escrow.amount.toString(),
      },
      reason: `escrow refund for refund ${input.refundId}`,
      changedFields: ['status', 'amount'],
    });

    this.events.emit('wallets.WalletDebited', {
      walletId: result.walletId,
      amount: Number(kesToBigInt(unholdMoney)),
      transactionId: result.transaction.id,
      paymentId: input.paymentId,
      refundId: input.refundId,
      at: new Date().toISOString(),
    });

    return {
      success: true as const,
      idempotent: false as const,
      escrow: toEscrowView(result.escrow),
    };
  }

  private async closeEscrow(
    escrowId: string,
    nextStatus: 'RELEASED' | 'FORFEITED' | 'REFUNDED',
    meta: {
      readonly actorId: string;
      readonly idempotencyKey?: string | null;
      readonly reason?: string | null;
    },
    mode: 'release' | 'forfeit' | 'refund',
  ) {
    const escrow = await this.prisma.escrowHold.findUnique({
      where: { id: escrowId },
    });
    if (!escrow) {
      throw new NotFoundException('Escrow hold not found');
    }
    if (escrow.status !== EscrowStatus.HELD) {
      if (escrow.status === nextStatus) {
        return {
          success: true as const,
          idempotent: true as const,
          escrow: toEscrowView(escrow),
        };
      }
      throw new BadRequestException(
        `Escrow is ${escrow.status}; only HELD holds can be ${mode}d`,
      );
    }

    if (!escrow.beneficiaryId) {
      throw new BadRequestException('Escrow hold has no beneficiaryId');
    }

    const wallet = await this.wallets.getOrCreate(
      escrow.beneficiaryType,
      escrow.beneficiaryId,
      escrow.currency,
    );
    const money = kesFromBigInt(escrow.amount);
    const key = meta.idempotencyKey?.trim();
    const reference = key
      ? `idem:escrow:${mode}:${key}`
      : `escrow:${mode}:${escrow.id}`;

    if (key) {
      const existingTxn = await this.prisma.walletTransaction.findFirst({
        where: { walletId: wallet.id, reference },
      });
      if (existingTxn) {
        const refreshed = await this.prisma.escrowHold.findUniqueOrThrow({
          where: { id: escrowId },
        });
        return {
          success: true as const,
          idempotent: true as const,
          escrow: toEscrowView(refreshed),
        };
      }
    }

    const result = await this.prisma.$transaction(async (tx: TxClient) => {
      const freshEscrow = await tx.escrowHold.findUnique({
        where: { id: escrowId },
      });
      if (!freshEscrow || freshEscrow.status !== EscrowStatus.HELD) {
        throw new BadRequestException('Escrow hold is no longer HELD');
      }

      const freshWallet = await this.wallets.loadForUpdate(tx, wallet.id);
      const snapshot = snapshotFromBigInt(
        freshWallet.balanceAmount,
        freshWallet.holdAmount,
        freshWallet.version,
      );
      const op =
        mode === 'release'
          ? applyRelease(snapshot, money)
          : applyUnhold(snapshot, money);

      const applied = await this.wallets.applyInTx(tx, freshWallet, op, {
        actorId: meta.actorId,
        actorType: ActorType.USER,
        paymentId: freshEscrow.paymentId,
        journalEntryId: freshEscrow.journalEntryId,
        reference,
        description:
          meta.reason ??
          `Escrow ${mode} ${freshEscrow.id} (${kesToBigInt(money)} ${freshEscrow.currency})`,
        reason: meta.reason,
      });

      const updated = await tx.escrowHold.update({
        where: { id: escrowId },
        data: {
          status: nextStatus,
          releasedAt: new Date(),
        },
      });

      return { escrow: updated, transaction: applied.transaction, walletId: wallet.id };
    });

    await this.audit.record({
      tableName: 'escrow_holds',
      recordId: escrowId,
      action: AuditAction.STATUS_CHANGE,
      actorId: meta.actorId,
      actorType: ActorType.USER,
      beforeData: { status: EscrowStatus.HELD },
      afterData: { status: nextStatus },
      reason: meta.reason ?? `escrow ${mode}`,
      changedFields: ['status', 'releasedAt'],
    });

    if (mode === 'release') {
      const payment = await this.prisma.payment.findUnique({
        where: { id: result.escrow.paymentId },
        select: { purpose: true },
      });
      await this.postingEngine.postEscrowRelease({
        escrowId,
        beneficiaryType: result.escrow.beneficiaryType,
        amount: result.escrow.amount,
        currency: result.escrow.currency,
        purpose: payment?.purpose ?? null,
        description: `Escrow release ${escrowId}`,
      });
      this.events.emit('wallets.EscrowReleased', {
        escrowId,
        walletId: result.walletId,
        paymentId: result.escrow.paymentId,
        amount: Number(result.escrow.amount),
        transactionId: result.transaction.id,
        at: new Date().toISOString(),
      });
      this.events.emit('wallets.WalletCredited', {
        walletId: result.walletId,
        amount: Number(result.escrow.amount),
        transactionId: result.transaction.id,
        paymentId: result.escrow.paymentId,
        at: new Date().toISOString(),
      });
    } else {
      this.events.emit('wallets.WalletDebited', {
        walletId: result.walletId,
        amount: Number(result.escrow.amount),
        transactionId: result.transaction.id,
        paymentId: result.escrow.paymentId,
        at: new Date().toISOString(),
      });
    }

    return {
      success: true as const,
      idempotent: false as const,
      escrow: toEscrowView(result.escrow),
    };
  }
}
