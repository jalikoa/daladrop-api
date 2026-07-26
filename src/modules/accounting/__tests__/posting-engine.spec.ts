import {
  AccountType,
  JournalEntryStatus,
  NormalBalance,
  PaymentLifecycleStatus,
  PaymentPurpose,
  PaymentStatus,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CoaCodes } from '../constants/coa-codes';
import { AccountingPeriodsService } from '../use-cases/accounting-periods.service';
import { JournalService } from '../use-cases/journal.service';
import { PostingEngineService } from '../use-cases/posting-engine.service';

function account(code: string, type: AccountType) {
  return {
    id: `acc-${code}`,
    chartOfAccountsId: 'chart-1',
    code,
    name: code,
    accountType: type,
    normalBalance:
      type === AccountType.ASSET || type === AccountType.EXPENSE
        ? NormalBalance.DEBIT
        : NormalBalance.CREDIT,
    parentId: null,
    currency: 'KES',
    isSystem: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('PostingEngineService', () => {
  const paymentId = '11111111-1111-4111-8111-111111111111';
  const periodId = '22222222-2222-4222-8222-222222222222';
  const chart = {
    id: 'chart-1',
    code: 'DALADROP_KES',
    name: 'Daladrop',
    description: null,
    currency: 'KES',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const cash = account(CoaCodes.PLATFORM_CASH, AccountType.ASSET);
  const escrow = account(CoaCodes.ESCROW_COMMERCE, AccountType.LIABILITY);

  let prisma: {
    journalEntry: {
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
    };
    payment: { findUnique: jest.Mock };
    chartOfAccounts: { findUnique: jest.Mock };
    account: { findMany: jest.Mock };
    accountingPeriod: { findFirst: jest.Mock; findUnique: jest.Mock };
    fiscalPeriod: { findFirst: jest.Mock; create: jest.Mock };
    accountBalance: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    auditRecord: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let events: { emit: jest.Mock };
  let engine: PostingEngineService;

  beforeEach(() => {
    const period = {
      id: periodId,
      fiscalPeriodId: 'fy-1',
      name: '2026-07',
      startsAt: new Date('2026-07-01T00:00:00.000Z'),
      endsAt: new Date('2026-08-01T00:00:00.000Z'),
      status: 'OPEN',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prisma = {
      journalEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(async ({ data, include }) => ({
          id: 'je-1',
          entryNumber: data.entryNumber,
          status: data.status,
          description: data.description,
          valueDate: data.valueDate,
          currency: data.currency,
          paymentId: data.paymentId,
          accountingPeriodId: data.accountingPeriodId,
          externalRef: null,
          internalRef: null,
          postedAt: data.postedAt,
          postedBy: data.postedBy ?? null,
          voidedAt: null,
          voidReason: null,
          reversesEntryId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lines: (data.lines?.create ?? []).map(
            (
              line: {
                accountId: string;
                lineNo: number;
                debitAmount: bigint;
                creditAmount: bigint;
                currency: string;
                memo: string | null;
              },
              idx: number,
            ) => ({
              id: `jl-${idx}`,
              journalEntryId: 'je-1',
              accountId: line.accountId,
              lineNo: line.lineNo,
              debitAmount: line.debitAmount,
              creditAmount: line.creditAmount,
              currency: line.currency,
              memo: line.memo,
              account:
                line.accountId === cash.id
                  ? cash
                  : line.accountId === escrow.id
                    ? escrow
                    : cash,
            }),
          ),
          ...(include ? {} : {}),
        })),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: paymentId,
          purpose: PaymentPurpose.ORDER,
          status: PaymentStatus.SUCCESS,
          lifecycleStatus: PaymentLifecycleStatus.SUCCEEDED,
          amount: 1500n,
          currency: 'KES',
          reference: 'PAY-1',
          completedAt: new Date('2026-07-15T12:00:00.000Z'),
          updatedAt: new Date('2026-07-15T12:00:00.000Z'),
          allocations: [],
        }),
      },
      chartOfAccounts: {
        findUnique: jest.fn().mockResolvedValue(chart),
      },
      account: {
        findMany: jest.fn().mockResolvedValue([cash, escrow]),
      },
      accountingPeriod: {
        findFirst: jest.fn().mockResolvedValue(period),
        findUnique: jest.fn().mockResolvedValue(period),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      accountBalance: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      auditRecord: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );

    events = { emit: jest.fn() };
    const periods = new AccountingPeriodsService(
      prisma as never,
      { record: jest.fn() } as never,
      events as unknown as EventEmitter2,
    );
    const journals = new JournalService(
      prisma as never,
      periods,
      events as unknown as EventEmitter2,
    );
    engine = new PostingEngineService(
      prisma as never,
      journals,
      events as unknown as EventEmitter2,
    );
  });

  it('posts a balanced journal and upserts balances', async () => {
    const result = await engine.postPaymentCollected(paymentId);

    expect(result.idempotent).toBe(false);
    expect(result.journal.status).toBe(JournalEntryStatus.POSTED);
    expect(result.journal.paymentId).toBe(paymentId);
    expect(result.journal.lines).toHaveLength(2);
    expect(prisma.journalEntry.create).toHaveBeenCalled();
    expect(prisma.accountBalance.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditRecord.create).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith(
      'accounting.JournalPosted',
      expect.objectContaining({ paymentId }),
    );
  });

  it('returns existing journal when paymentId already posted', async () => {
    const existing = {
      id: 'je-existing',
      entryNumber: 'JE-20260715-0001',
      status: JournalEntryStatus.POSTED,
      description: 'existing',
      valueDate: new Date(),
      currency: 'KES',
      paymentId,
      accountingPeriodId: periodId,
      externalRef: null,
      internalRef: null,
      postedAt: new Date(),
      postedBy: null,
      voidedAt: null,
      voidReason: null,
      reversesEntryId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lines: [],
    };
    prisma.journalEntry.findUnique.mockResolvedValue(existing);

    const result = await engine.postPaymentCollected(paymentId);
    expect(result.idempotent).toBe(true);
    expect(result.journal.id).toBe('je-existing');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('accepts PaymentCompleted event payload', async () => {
    const result = await engine.postPaymentCollected({
      eventId: 'evt-1',
      eventType: 'PaymentCompleted',
      aggregateType: 'Payment',
      aggregateId: paymentId,
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: { paymentId },
    });
    expect(result.success).toBe(true);
    expect(prisma.payment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: paymentId } }),
    );
  });
});
