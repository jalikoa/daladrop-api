import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorType,
  AuditAction,
  Prisma,
  WalletOwnerType,
  type Wallet,
  type WalletTransaction,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  kesFromDecimalString,
  kesToBigInt,
  type Money,
} from '../../../shared/money';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';
import {
  platformWalletOwnerId,
} from '../constants/platform-wallet';
import {
  snapshotFromBigInt,
  walletBalanceFromAmounts,
} from '../domain/wallet-balance';
import {
  applyAdjust,
  applyCredit,
  applyDebit,
  applyHold,
  applyRelease,
  applyUnhold,
  InsufficientAvailableError,
  InsufficientHeldError,
  InvalidWalletAmountError,
  type WalletOpResult,
} from '../domain/wallet-ops';

export type TxClient = Prisma.TransactionClient;

export interface WalletMutationMeta {
  readonly actorId?: string | null;
  readonly actorType?: ActorType;
  readonly paymentId?: string | null;
  readonly journalEntryId?: string | null;
  readonly reference?: string | null;
  readonly description?: string | null;
  readonly idempotencyKey?: string | null;
  readonly reason?: string | null;
}

export interface WalletPublicView {
  readonly id: string;
  readonly currency: string;
  readonly ownerType: WalletOwnerType;
  readonly ownerId: string;
  readonly available: number;
  readonly held: number;
  readonly pending: number;
  readonly total: number;
  readonly balance: number;
  readonly holdAmount: number;
  readonly version: number;
}

function parseKesAmount(raw: string): Money {
  try {
    return kesFromDecimalString(raw.trim());
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : `Invalid amount "${raw}"`,
    );
  }
}

function idemReference(key: string): string {
  return `idem:${key.trim()}`;
}

function toWalletView(row: Wallet): WalletPublicView {
  const balances = walletBalanceFromAmounts(row.balanceAmount, row.holdAmount);
  return {
    id: row.id,
    currency: row.currency,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    available: balances.available.amount,
    held: balances.held.amount,
    pending: balances.pending.amount,
    total: balances.total.amount,
    balance: balances.available.amount,
    holdAmount: balances.held.amount,
    version: row.version,
  };
}

function toTxnView(row: WalletTransaction) {
  return {
    id: row.id,
    walletId: row.walletId,
    type: row.type,
    debitAmount: Number(row.debitAmount),
    creditAmount: Number(row.creditAmount),
    currency: row.currency,
    balanceAfter: Number(row.balanceAfter),
    reference: row.reference,
    journalEntryId: row.journalEntryId,
    paymentId: row.paymentId,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class WalletService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: EventEmitter2,
  ) {}

  public async ensurePlatformWallet(): Promise<Wallet> {
    return this.getOrCreate(WalletOwnerType.PLATFORM, platformWalletOwnerId());
  }

  public async getOrCreate(
    ownerType: WalletOwnerType,
    ownerId: string,
    currency = 'KES',
  ): Promise<Wallet> {
    const existing = await this.prisma.wallet.findUnique({
      where: {
        ownerType_ownerId_currency: { ownerType, ownerId, currency },
      },
    });
    if (existing) {
      return existing;
    }

    const data: Prisma.WalletCreateInput = {
      ownerType,
      ownerId,
      currency,
      balanceAmount: 0n,
      holdAmount: 0n,
      version: 0,
    };

    if (ownerType === WalletOwnerType.CUSTOMER) {
      data.user = { connect: { id: ownerId } };
    } else if (ownerType === WalletOwnerType.MERCHANT) {
      data.merchant = { connect: { id: ownerId } };
    } else if (ownerType === WalletOwnerType.RIDER) {
      data.rider = { connect: { id: ownerId } };
    } else if (ownerType === WalletOwnerType.ORGANIZER) {
      data.organizer = { connect: { id: ownerId } };
    }

    try {
      return await this.prisma.wallet.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.wallet.findUnique({
          where: {
            ownerType_ownerId_currency: { ownerType, ownerId, currency },
          },
        });
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }

  public async getById(id: string): Promise<WalletPublicView> {
    const row = await this.prisma.wallet.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Wallet not found');
    }
    return toWalletView(row);
  }

  public async getBalance(
    ownerType: WalletOwnerType,
    ownerId: string,
  ): Promise<{ success: true; wallet: WalletPublicView }> {
    const wallet = await this.getOrCreate(ownerType, ownerId);
    return { success: true, wallet: toWalletView(wallet) };
  }

  public async list(query: {
    ownerType?: WalletOwnerType;
    ownerId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Prisma.WalletWhereInput = {};
    if (query.ownerType) {
      where.ownerType = query.ownerType;
    }
    if (query.ownerId) {
      where.ownerId = query.ownerId;
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.wallet.count({ where }),
      this.prisma.wallet.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      success: true as const,
      items: rows.map(toWalletView),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  public async listTransactions(
    walletId: string,
    query: { page?: number; limit?: number } = {},
  ) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where = { walletId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.walletTransaction.count({ where }),
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      success: true as const,
      walletId,
      items: rows.map(toTxnView),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  public async credit(
    walletId: string,
    amountRaw: string | Money,
    meta: WalletMutationMeta = {},
  ) {
    const money =
      typeof amountRaw === 'string' ? parseKesAmount(amountRaw) : amountRaw;
    return this.mutate(walletId, (snapshot) => applyCredit(snapshot, money), {
      ...meta,
      event: 'wallets.WalletCredited',
    });
  }

  public async debit(
    walletId: string,
    amountRaw: string | Money,
    meta: WalletMutationMeta = {},
  ) {
    const money =
      typeof amountRaw === 'string' ? parseKesAmount(amountRaw) : amountRaw;
    return this.mutate(walletId, (snapshot) => applyDebit(snapshot, money), {
      ...meta,
      event: 'wallets.WalletDebited',
    });
  }

  public async hold(
    walletId: string,
    amountRaw: string | Money,
    meta: WalletMutationMeta & { readonly fromExternal?: boolean } = {},
  ) {
    const money =
      typeof amountRaw === 'string' ? parseKesAmount(amountRaw) : amountRaw;
    return this.mutate(
      walletId,
      (snapshot) =>
        applyHold(snapshot, money, { fromExternal: meta.fromExternal }),
      meta,
    );
  }

  public async release(
    walletId: string,
    amountRaw: string | Money,
    meta: WalletMutationMeta = {},
  ) {
    const money =
      typeof amountRaw === 'string' ? parseKesAmount(amountRaw) : amountRaw;
    return this.mutate(walletId, (snapshot) => applyRelease(snapshot, money), {
      ...meta,
      event: 'wallets.WalletCredited',
    });
  }

  public async unhold(
    walletId: string,
    amountRaw: string | Money,
    meta: WalletMutationMeta = {},
  ) {
    const money =
      typeof amountRaw === 'string' ? parseKesAmount(amountRaw) : amountRaw;
    return this.mutate(walletId, (snapshot) => applyUnhold(snapshot, money), {
      ...meta,
      event: 'wallets.WalletDebited',
    });
  }

  public async adjust(
    walletId: string,
    amountRaw: string | Money,
    meta: WalletMutationMeta & { readonly reason: string },
  ) {
    if (!meta.reason?.trim()) {
      throw new BadRequestException('reason is required for adjustments');
    }
    const money =
      typeof amountRaw === 'string' ? parseKesAmount(amountRaw) : amountRaw;
    const event = money.isNegative()
      ? 'wallets.WalletDebited'
      : 'wallets.WalletCredited';
    return this.mutate(walletId, (snapshot) => applyAdjust(snapshot, money), {
      ...meta,
      description: meta.description ?? meta.reason,
      event,
    });
  }

  public async transfer(
    fromWalletId: string,
    toWalletId: string,
    amountRaw: string,
    meta: WalletMutationMeta = {},
  ) {
    if (fromWalletId === toWalletId) {
      throw new BadRequestException('Cannot transfer to the same wallet');
    }
    const money = parseKesAmount(amountRaw);
    const key = meta.idempotencyKey?.trim();
    if (key) {
      const existing = await this.prisma.walletTransaction.findFirst({
        where: {
          walletId: fromWalletId,
          reference: idemReference(key),
        },
      });
      if (existing) {
        const [from, to] = await Promise.all([
          this.getById(fromWalletId),
          this.getById(toWalletId),
        ]);
        return {
          success: true as const,
          idempotent: true as const,
          from,
          to,
          debitTransaction: toTxnView(existing),
        };
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const fromRow = await tx.wallet.findUnique({
        where: { id: fromWalletId },
      });
      const toRow = await tx.wallet.findUnique({ where: { id: toWalletId } });
      if (!fromRow || !toRow) {
        throw new NotFoundException('Wallet not found');
      }

      let debitOp: WalletOpResult;
      let creditOp: WalletOpResult;
      try {
        debitOp = applyDebit(
          snapshotFromBigInt(
            fromRow.balanceAmount,
            fromRow.holdAmount,
            fromRow.version,
          ),
          money,
        );
        creditOp = applyCredit(
          snapshotFromBigInt(
            toRow.balanceAmount,
            toRow.holdAmount,
            toRow.version,
          ),
          money,
        );
      } catch (error) {
        this.rethrowDomain(error);
      }

      const reference =
        key != null && key.length > 0
          ? idemReference(key)
          : (meta.reference ?? null);

      const debitTxn = await this.persistOp(tx, fromRow, debitOp, {
        ...meta,
        reference,
        description: meta.description ?? `Transfer to ${toWalletId}`,
      });
      const creditTxn = await this.persistOp(tx, toRow, creditOp, {
        ...meta,
        reference: reference ? `${reference}:credit` : null,
        description: meta.description ?? `Transfer from ${fromWalletId}`,
      });

      const fromUpdated = await tx.wallet.findUniqueOrThrow({
        where: { id: fromWalletId },
      });
      const toUpdated = await tx.wallet.findUniqueOrThrow({
        where: { id: toWalletId },
      });
      return { fromUpdated, toUpdated, debitTxn, creditTxn };
    });

    await this.audit.record({
      tableName: 'wallets',
      recordId: fromWalletId,
      action: AuditAction.UPDATE,
      actorId: meta.actorId,
      actorType: meta.actorType ?? ActorType.USER,
      afterData: {
        transferTo: toWalletId,
        amount: money.amount,
      },
      reason: meta.reason ?? meta.description ?? 'wallet transfer',
      changedFields: ['balanceAmount'],
    });

    this.events.emit('wallets.WalletDebited', {
      walletId: fromWalletId,
      amount: money.amount,
      transactionId: result.debitTxn.id,
      at: new Date().toISOString(),
    });
    this.events.emit('wallets.WalletCredited', {
      walletId: toWalletId,
      amount: money.amount,
      transactionId: result.creditTxn.id,
      at: new Date().toISOString(),
    });

    return {
      success: true as const,
      idempotent: false as const,
      from: toWalletView(result.fromUpdated),
      to: toWalletView(result.toUpdated),
      debitTransaction: toTxnView(result.debitTxn),
      creditTransaction: toTxnView(result.creditTxn),
    };
  }

  /** Applies an op inside an existing transaction (escrow / mirroring). */
  public async applyInTx(
    tx: TxClient,
    wallet: Wallet,
    op: WalletOpResult,
    meta: WalletMutationMeta = {},
  ): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
    const transaction = await this.persistOp(tx, wallet, op, meta);
    const updated = await tx.wallet.findUniqueOrThrow({
      where: { id: wallet.id },
    });
    return { wallet: updated, transaction };
  }

  public async loadForUpdate(tx: TxClient, walletId: string): Promise<Wallet> {
    // Row lock prevents concurrent escrow/settlement races beyond optimistic versioning.
    const rows = await tx.$queryRaw<Wallet[]>`
      SELECT * FROM wallets WHERE id = ${walletId}::uuid FOR UPDATE
    `;
    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Wallet not found');
    }
    return row;
  }

  private async mutate(
    walletId: string,
    apply: (snapshot: ReturnType<typeof snapshotFromBigInt>) => WalletOpResult,
    meta: WalletMutationMeta & { readonly event?: string },
  ) {
    const key = meta.idempotencyKey?.trim();
    if (key) {
      const existing = await this.prisma.walletTransaction.findFirst({
        where: { walletId, reference: idemReference(key) },
      });
      if (existing) {
        const wallet = await this.getById(walletId);
        return {
          success: true as const,
          idempotent: true as const,
          wallet,
          transaction: toTxnView(existing),
        };
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await this.loadForUpdate(tx, walletId);
      let op: WalletOpResult;
      try {
        op = apply(
          snapshotFromBigInt(
            locked.balanceAmount,
            locked.holdAmount,
            locked.version,
          ),
        );
      } catch (error) {
        this.rethrowDomain(error);
      }
      const reference =
        key != null && key.length > 0
          ? idemReference(key)
          : (meta.reference ?? null);
      const transaction = await this.persistOp(tx, locked, op, {
        ...meta,
        reference,
      });
      const updated = await tx.wallet.findUniqueOrThrow({
        where: { id: walletId },
      });
      return { updated, transaction };
    });

    await this.audit.record({
      tableName: 'wallets',
      recordId: walletId,
      action: AuditAction.UPDATE,
      actorId: meta.actorId,
      actorType: meta.actorType ?? ActorType.SYSTEM,
      afterData: {
        type: result.transaction.type,
        balanceAmount: Number(result.updated.balanceAmount),
        holdAmount: Number(result.updated.holdAmount),
        version: result.updated.version,
      },
      reason: meta.reason ?? meta.description ?? undefined,
      changedFields: ['balanceAmount', 'holdAmount', 'version'],
    });

    if (meta.event) {
      this.events.emit(meta.event, {
        walletId,
        amount:
          Number(result.transaction.creditAmount) ||
          Number(result.transaction.debitAmount),
        transactionId: result.transaction.id,
        paymentId: result.transaction.paymentId,
        journalEntryId: result.transaction.journalEntryId,
        at: new Date().toISOString(),
      });
    }

    return {
      success: true as const,
      idempotent: false as const,
      wallet: toWalletView(result.updated),
      transaction: toTxnView(result.transaction),
    };
  }

  private async persistOp(
    tx: TxClient,
    wallet: Wallet,
    op: WalletOpResult,
    meta: WalletMutationMeta,
  ): Promise<WalletTransaction> {
    const updated = await tx.wallet.updateMany({
      where: { id: wallet.id, version: wallet.version },
      data: {
        balanceAmount: kesToBigInt(op.next.available),
        holdAmount: kesToBigInt(op.next.held),
        version: op.next.version,
      },
    });
    if (updated.count === 0) {
      throw new ConflictException(
        'Wallet version conflict — retry the operation',
      );
    }

    return tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: op.txn.type,
        debitAmount: kesToBigInt(op.txn.debitAmount),
        creditAmount: kesToBigInt(op.txn.creditAmount),
        currency: wallet.currency,
        balanceAfter: kesToBigInt(op.txn.balanceAfter),
        reference: meta.reference ?? null,
        journalEntryId: meta.journalEntryId ?? null,
        paymentId: meta.paymentId ?? null,
        description: meta.description ?? null,
      },
    });
  }

  private rethrowDomain(error: unknown): never {
    if (
      error instanceof InsufficientAvailableError ||
      error instanceof InsufficientHeldError ||
      error instanceof InvalidWalletAmountError
    ) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}
