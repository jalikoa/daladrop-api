import { AccountType, type Account, type Prisma } from '@prisma/client';
import type { JournalLineDraft } from '../domain/journal';
import { DEFAULT_CHART_CODE } from '../constants/coa-codes';

export type TxClient = Prisma.TransactionClient;

export function closingBalanceFor(
  accountType: AccountType,
  debitTotal: bigint,
  creditTotal: bigint,
): bigint {
  if (
    accountType === AccountType.ASSET ||
    accountType === AccountType.EXPENSE
  ) {
    return debitTotal - creditTotal;
  }
  return creditTotal - debitTotal;
}

export async function resolveAccountsByCode(
  tx: TxClient,
  codes: readonly string[],
  chartCode = DEFAULT_CHART_CODE,
): Promise<Map<string, Account>> {
  const chart = await tx.chartOfAccounts.findUnique({
    where: { code: chartCode },
  });
  if (!chart) {
    throw new Error(`Chart of accounts ${chartCode} not found — run seed 002`);
  }
  const accounts = await tx.account.findMany({
    where: {
      chartOfAccountsId: chart.id,
      code: { in: [...new Set(codes)] },
    },
  });
  const map = new Map(accounts.map((a) => [a.code, a]));
  for (const code of codes) {
    if (!map.has(code)) {
      throw new Error(
        `Account ${code} missing on chart ${chartCode} — run seed 002`,
      );
    }
  }
  return map;
}

export async function nextEntryNumber(
  tx: TxClient,
  valueDate: Date,
): Promise<string> {
  const day = [
    valueDate.getUTCFullYear(),
    String(valueDate.getUTCMonth() + 1).padStart(2, '0'),
    String(valueDate.getUTCDate()).padStart(2, '0'),
  ].join('');
  const prefix = `JE-${day}-`;
  const count = await tx.journalEntry.count({
    where: { entryNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

export async function applyBalanceIncrements(
  tx: TxClient,
  periodId: string,
  currency: string,
  lines: readonly { account: Account; debit: bigint; credit: bigint }[],
): Promise<void> {
  const byAccount = new Map<
    string,
    { account: Account; debit: bigint; credit: bigint }
  >();
  for (const line of lines) {
    const prev = byAccount.get(line.account.id) ?? {
      account: line.account,
      debit: 0n,
      credit: 0n,
    };
    prev.debit += line.debit;
    prev.credit += line.credit;
    byAccount.set(line.account.id, prev);
  }

  for (const { account, debit, credit } of byAccount.values()) {
    const existing = await tx.accountBalance.findUnique({
      where: {
        accountId_accountingPeriodId: {
          accountId: account.id,
          accountingPeriodId: periodId,
        },
      },
    });
    const debitTotal = (existing?.debitTotal ?? 0n) + debit;
    const creditTotal = (existing?.creditTotal ?? 0n) + credit;
    const closingBalance = closingBalanceFor(
      account.accountType,
      debitTotal,
      creditTotal,
    );
    if (existing) {
      await tx.accountBalance.update({
        where: { id: existing.id },
        data: { debitTotal, creditTotal, closingBalance },
      });
    } else {
      await tx.accountBalance.create({
        data: {
          accountId: account.id,
          accountingPeriodId: periodId,
          debitTotal,
          creditTotal,
          closingBalance,
          currency,
        },
      });
    }
  }
}

export function mapDraftLinesToPersisted(
  draftLines: readonly JournalLineDraft[],
  accounts: Map<string, Account>,
  currency: string,
): Array<{
  account: Account;
  lineNo: number;
  debitAmount: bigint;
  creditAmount: bigint;
  memo?: string;
  currency: string;
}> {
  return draftLines.map((line, index) => {
    const account = accounts.get(line.accountCode);
    if (!account) {
      throw new Error(`Account ${line.accountCode} not resolved`);
    }
    return {
      account,
      lineNo: index + 1,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      memo: line.memo,
      currency,
    };
  });
}

export function journalEntryInclude() {
  return {
    lines: {
      include: { account: true },
      orderBy: { lineNo: 'asc' as const },
    },
  };
}

export function toJournalView(
  entry: {
    id: string;
    entryNumber: string;
    status: string;
    description: string | null;
    valueDate: Date;
    currency: string;
    paymentId: string | null;
    accountingPeriodId: string | null;
    externalRef: string | null;
    internalRef: string | null;
    postedAt: Date | null;
    postedBy: string | null;
    voidedAt: Date | null;
    voidReason: string | null;
    reversesEntryId: string | null;
    createdAt: Date;
    updatedAt: Date;
    lines?: Array<{
      id: string;
      lineNo: number;
      debitAmount: bigint;
      creditAmount: bigint;
      currency: string;
      memo: string | null;
      accountId: string;
      account?: { code: string; name: string; accountType: string };
    }>;
  },
) {
  return {
    id: entry.id,
    entryNumber: entry.entryNumber,
    status: entry.status,
    description: entry.description,
    valueDate: entry.valueDate.toISOString(),
    currency: entry.currency,
    paymentId: entry.paymentId,
    accountingPeriodId: entry.accountingPeriodId,
    externalRef: entry.externalRef,
    internalRef: entry.internalRef,
    postedAt: entry.postedAt?.toISOString() ?? null,
    postedBy: entry.postedBy,
    voidedAt: entry.voidedAt?.toISOString() ?? null,
    voidReason: entry.voidReason,
    reversesEntryId: entry.reversesEntryId,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    lines: (entry.lines ?? []).map((line) => ({
      id: line.id,
      lineNo: line.lineNo,
      accountId: line.accountId,
      accountCode: line.account?.code,
      accountName: line.account?.name,
      accountType: line.account?.accountType,
      debitAmount: line.debitAmount.toString(),
      creditAmount: line.creditAmount.toString(),
      currency: line.currency,
      memo: line.memo,
    })),
  };
}
