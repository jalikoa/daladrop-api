import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorType,
  AuditAction,
  FiscalPeriodStatus,
  JournalEntryStatus,
  type Prisma,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  InvalidJournalLineError,
  JournalDraft,
  UnbalancedJournalError,
} from '../domain/journal';
import { AccountingPeriodsService } from './accounting-periods.service';
import {
  applyBalanceIncrements,
  journalEntryInclude,
  mapDraftLinesToPersisted,
  nextEntryNumber,
  resolveAccountsByCode,
  toJournalView,
  type TxClient,
} from './journal-persistence.util';

function parseMoney(value: string): bigint {
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new BadRequestException(`Invalid amount "${value}"`);
  }
  return BigInt(trimmed);
}

@Injectable()
export class JournalService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly periods: AccountingPeriodsService,
    private readonly events: EventEmitter2,
  ) {}

  public async list(query: {
    status?: JournalEntryStatus | string;
    paymentId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Prisma.JournalEntryWhereInput = {};
    if (query.status) {
      where.status = query.status as JournalEntryStatus;
    }
    if (query.paymentId) {
      where.paymentId = query.paymentId;
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.journalEntry.count({ where }),
      this.prisma.journalEntry.findMany({
        where,
        include: journalEntryInclude(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      success: true as const,
      items: rows.map(toJournalView),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  public async getById(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: journalEntryInclude(),
    });
    if (!entry) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }
    return { success: true as const, journal: toJournalView(entry) };
  }

  public async createDraft(
    actorId: string,
    input: {
      description?: string;
      currency?: string;
      valueDate?: string;
      externalRef?: string;
      lines: ReadonlyArray<{
        accountCode: string;
        debitAmount: string;
        creditAmount: string;
        memo?: string;
      }>;
    },
  ) {
    const draft = new JournalDraft(
      (input.currency ?? 'KES').toUpperCase(),
      input.description,
    );
    for (const line of input.lines) {
      const debit = parseMoney(line.debitAmount);
      const credit = parseMoney(line.creditAmount);
      if (debit > 0n && credit > 0n) {
        throw new BadRequestException(
          `Line ${line.accountCode} must not have both debit and credit`,
        );
      }
      if (debit > 0n) draft.addDebit(line.accountCode, debit, line.memo);
      else if (credit > 0n) draft.addCredit(line.accountCode, credit, line.memo);
      else {
        throw new BadRequestException(
          `Line ${line.accountCode} must have debit or credit`,
        );
      }
    }
    try {
      draft.assertBalanced();
    } catch (error) {
      if (
        error instanceof UnbalancedJournalError ||
        error instanceof InvalidJournalLineError
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const valueDate = input.valueDate ? new Date(input.valueDate) : new Date();
    if (Number.isNaN(valueDate.getTime())) {
      throw new BadRequestException('Invalid valueDate');
    }

    const entry = await this.prisma.$transaction(async (tx) => {
      const period = await this.periods.ensureOpenPeriod(valueDate, tx);
      if (period.status !== FiscalPeriodStatus.OPEN) {
        throw new BadRequestException('Accounting period is not OPEN');
      }
      const accounts = await resolveAccountsByCode(
        tx,
        draft.getLines().map((l) => l.accountCode),
      );
      const entryNumber = await nextEntryNumber(tx, valueDate);
      const created = await tx.journalEntry.create({
        data: {
          entryNumber,
          status: JournalEntryStatus.DRAFT,
          description: input.description ?? null,
          valueDate,
          currency: draft.currency,
          accountingPeriodId: period.id,
          externalRef: input.externalRef ?? null,
          lines: {
            create: mapDraftLinesToPersisted(
              draft.getLines(),
              accounts,
              draft.currency,
            ).map((line) => ({
              accountId: line.account.id,
              lineNo: line.lineNo,
              debitAmount: line.debitAmount,
              creditAmount: line.creditAmount,
              currency: line.currency,
              baseCurrency: line.currency,
              baseDebitAmount: line.debitAmount,
              baseCreditAmount: line.creditAmount,
              memo: line.memo ?? null,
            })),
          },
        },
        include: journalEntryInclude(),
      });
      await tx.auditRecord.create({
        data: {
          tableName: 'journal_entries',
          recordId: created.id,
          action: AuditAction.INSERT,
          actorId,
          actorType: ActorType.USER,
          afterData: toJournalView(created) as unknown as Prisma.InputJsonValue,
        },
      });
      return created;
    });

    return { success: true as const, journal: toJournalView(entry) };
  }

  public async postDraft(actorId: string, id: string) {
    const existing = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: journalEntryInclude(),
    });
    if (!existing) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }
    if (existing.status === JournalEntryStatus.POSTED) {
      return { success: true as const, journal: toJournalView(existing) };
    }
    if (existing.status !== JournalEntryStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot post journal in status ${existing.status}`,
      );
    }

    const posted = await this.prisma.$transaction(async (tx) => {
      const periodId =
        existing.accountingPeriodId ??
        (await this.periods.ensureOpenPeriod(existing.valueDate, tx)).id;
      const period = await tx.accountingPeriod.findUnique({
        where: { id: periodId },
      });
      if (!period || period.status !== FiscalPeriodStatus.OPEN) {
        throw new BadRequestException('Accounting period is not OPEN');
      }

      const accounts = await resolveAccountsByCode(
        tx,
        existing.lines.map((l) => l.account.code),
      );
      const balanceLines = existing.lines.map((line) => ({
        account: accounts.get(line.account.code)!,
        debit: line.debitAmount,
        credit: line.creditAmount,
      }));
      await applyBalanceIncrements(
        tx,
        periodId,
        existing.currency,
        balanceLines,
      );

      const updated = await tx.journalEntry.update({
        where: { id },
        data: {
          status: JournalEntryStatus.POSTED,
          postedAt: new Date(),
          postedBy: actorId,
          accountingPeriodId: periodId,
        },
        include: journalEntryInclude(),
      });

      await tx.auditRecord.create({
        data: {
          tableName: 'journal_entries',
          recordId: updated.id,
          action: AuditAction.STATUS_CHANGE,
          actorId,
          actorType: ActorType.USER,
          beforeData: { status: JournalEntryStatus.DRAFT },
          afterData: { status: JournalEntryStatus.POSTED },
          changedFields: ['status'],
        },
      });
      return updated;
    });

    this.events.emit('accounting.JournalPosted', {
      journalId: posted.id,
      entryNumber: posted.entryNumber,
      paymentId: posted.paymentId,
      at: new Date().toISOString(),
    });

    return { success: true as const, journal: toJournalView(posted) };
  }

  public async reversePosted(
    actorId: string,
    id: string,
    input: { reason: string; idempotencyKey: string },
  ) {
    const key = input.idempotencyKey.trim();
    if (!key) {
      throw new BadRequestException('idempotencyKey is required');
    }

    const byKey = await this.prisma.journalEntry.findFirst({
      where: { externalRef: `rev:${key}` },
      include: journalEntryInclude(),
    });
    if (byKey) {
      return { success: true as const, journal: toJournalView(byKey) };
    }

    const original = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: journalEntryInclude(),
    });
    if (!original) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }
    if (original.status === JournalEntryStatus.VOIDED) {
      const existingReversal = await this.prisma.journalEntry.findFirst({
        where: { reversesEntryId: original.id },
        include: journalEntryInclude(),
      });
      if (existingReversal) {
        return {
          success: true as const,
          journal: toJournalView(existingReversal),
        };
      }
      throw new BadRequestException('Journal is VOIDED without a reversal');
    }
    if (original.status !== JournalEntryStatus.POSTED) {
      throw new BadRequestException('Only POSTED journals can be reversed');
    }

    const reversal = await this.prisma.$transaction(async (tx) => {
      const again = await tx.journalEntry.findFirst({
        where: { externalRef: `rev:${key}` },
        include: journalEntryInclude(),
      });
      if (again) return again;

      const valueDate = new Date();
      const period = await this.periods.ensureOpenPeriod(valueDate, tx);
      const entryNumber = await nextEntryNumber(tx, valueDate);
      const accounts = await resolveAccountsByCode(
        tx,
        original.lines.map((l) => l.account.code),
      );

      const reverseLines = original.lines.map((line) => ({
        account: accounts.get(line.account.code)!,
        lineNo: line.lineNo,
        debitAmount: line.creditAmount,
        creditAmount: line.debitAmount,
        memo: `Reversal of ${original.entryNumber}`,
        currency: original.currency,
      }));

      await applyBalanceIncrements(
        tx,
        period.id,
        original.currency,
        reverseLines.map((l) => ({
          account: l.account,
          debit: l.debitAmount,
          credit: l.creditAmount,
        })),
      );

      const created = await tx.journalEntry.create({
        data: {
          entryNumber,
          status: JournalEntryStatus.POSTED,
          description: `Reversal of ${original.entryNumber}: ${input.reason}`,
          valueDate,
          currency: original.currency,
          accountingPeriodId: period.id,
          externalRef: `rev:${key}`,
          reversesEntryId: original.id,
          postedAt: valueDate,
          postedBy: actorId,
          lines: {
            create: reverseLines.map((line) => ({
              accountId: line.account.id,
              lineNo: line.lineNo,
              debitAmount: line.debitAmount,
              creditAmount: line.creditAmount,
              currency: line.currency,
              baseCurrency: line.currency,
              baseDebitAmount: line.debitAmount,
              baseCreditAmount: line.creditAmount,
              memo: line.memo,
            })),
          },
        },
        include: journalEntryInclude(),
      });

      await tx.journalEntry.update({
        where: { id: original.id },
        data: {
          status: JournalEntryStatus.VOIDED,
          voidedAt: valueDate,
          voidReason: input.reason,
        },
      });

      await tx.auditRecord.create({
        data: {
          tableName: 'journal_entries',
          recordId: original.id,
          action: AuditAction.STATUS_CHANGE,
          actorId,
          actorType: ActorType.USER,
          beforeData: { status: JournalEntryStatus.POSTED },
          afterData: {
            status: JournalEntryStatus.VOIDED,
            reversalId: created.id,
          },
          changedFields: ['status'],
          reason: input.reason,
        },
      });
      await tx.auditRecord.create({
        data: {
          tableName: 'journal_entries',
          recordId: created.id,
          action: AuditAction.INSERT,
          actorId,
          actorType: ActorType.USER,
          afterData: toJournalView(created) as unknown as Prisma.InputJsonValue,
          reason: input.reason,
        },
      });

      return created;
    });

    this.events.emit('accounting.JournalPosted', {
      journalId: reversal.id,
      entryNumber: reversal.entryNumber,
      reversesEntryId: original.id,
      at: new Date().toISOString(),
    });

    return { success: true as const, journal: toJournalView(reversal) };
  }

  /**
   * Shared create+post for system-generated journals (used by posting engine).
   * `paymentId` is optional — refund/settlement journals must omit it since
   * `JournalEntry.paymentId` is unique and already claimed by the original
   * payment-collected journal; use `externalRef` (e.g. `refund:{id}`,
   * `settlement:{id}`) to correlate those instead.
   */
  public async postDraftLinesInTx(
    tx: TxClient,
    input: {
      draft: JournalDraft;
      valueDate: Date;
      paymentId?: string | null;
      externalRef?: string | null;
      description?: string;
      actorId?: string | null;
      actorType?: ActorType;
    },
  ) {
    const period = await this.periods.ensureOpenPeriod(input.valueDate, tx);
    const accounts = await resolveAccountsByCode(
      tx,
      input.draft.getLines().map((l) => l.accountCode),
    );
    const entryNumber = await nextEntryNumber(tx, input.valueDate);
    const persisted = mapDraftLinesToPersisted(
      input.draft.getLines(),
      accounts,
      input.draft.currency,
    );

    await applyBalanceIncrements(
      tx,
      period.id,
      input.draft.currency,
      persisted.map((l) => ({
        account: l.account,
        debit: l.debitAmount,
        credit: l.creditAmount,
      })),
    );

    const created = await tx.journalEntry.create({
      data: {
        entryNumber,
        status: JournalEntryStatus.POSTED,
        description: input.description ?? input.draft.description ?? null,
        valueDate: input.valueDate,
        currency: input.draft.currency,
        accountingPeriodId: period.id,
        paymentId: input.paymentId ?? null,
        externalRef: input.externalRef ?? null,
        postedAt: new Date(),
        postedBy: input.actorId ?? null,
        lines: {
          create: persisted.map((line) => ({
            accountId: line.account.id,
            lineNo: line.lineNo,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            currency: line.currency,
            baseCurrency: line.currency,
            baseDebitAmount: line.debitAmount,
            baseCreditAmount: line.creditAmount,
            memo: line.memo ?? null,
          })),
        },
      },
      include: journalEntryInclude(),
    });

    await tx.auditRecord.create({
      data: {
        tableName: 'journal_entries',
        recordId: created.id,
        action: AuditAction.INSERT,
        actorId: input.actorId ?? null,
        actorType: input.actorType ?? ActorType.SYSTEM,
        afterData: toJournalView(created) as unknown as Prisma.InputJsonValue,
      },
    });

    return created;
  }
}
