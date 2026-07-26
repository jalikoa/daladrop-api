import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountType,
  EscrowStatus,
  JournalEntryStatus,
  ModuleOrderStatus,
  SettlementBatchStatus,
  WalletOwnerType,
  type Account,
  type AccountingPeriod,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DocumentService } from '../../../platform/documents/document.service';
import type { SpreadsheetWorkbook } from '../../../platform/documents/interfaces/spreadsheet-parser.interface';
import { CoaCodes, DEFAULT_CHART_CODE } from '../constants/coa-codes';

export type ReportType =
  | 'trial-balance'
  | 'general-ledger'
  | 'balance-sheet'
  | 'income-statement'
  | 'p-and-l'
  | 'account-statement'
  | 'accounts-payable'
  | 'accounts-receivable'
  | 'commission'
  | 'settlement';

/** Orders that never reached a paid/completed state contribute no realised commission. */
const COMMISSION_EXCLUDED_STATUSES: ModuleOrderStatus[] = [
  ModuleOrderStatus.PENDING_PAYMENT,
  ModuleOrderStatus.CANCELLED,
  ModuleOrderStatus.FAILED,
];

const WALLET_PAYABLE_OWNER_TYPES: WalletOwnerType[] = [
  WalletOwnerType.MERCHANT,
  WalletOwnerType.RIDER,
  WalletOwnerType.ORGANIZER,
];

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

@Injectable()
export class FinancialReportsService {
  private readonly documents = new DocumentService();

  public constructor(private readonly prisma: PrismaService) {}

  public async trialBalance(periodId?: string) {
    const period = await this.resolvePeriod(periodId);
    const balances = await this.prisma.accountBalance.findMany({
      where: { accountingPeriodId: period.id },
      include: { account: true },
      orderBy: { account: { code: 'asc' } },
    });

    const lines = balances.map((row) => ({
      accountCode: row.account.code,
      accountName: row.account.name,
      accountType: row.account.accountType,
      debitTotal: row.debitTotal.toString(),
      creditTotal: row.creditTotal.toString(),
      closingBalance: row.closingBalance.toString(),
    }));
    const totalDebit = balances.reduce((s, r) => s + r.debitTotal, 0n);
    const totalCredit = balances.reduce((s, r) => s + r.creditTotal, 0n);

    return {
      success: true as const,
      reportType: 'trial-balance' as const,
      period: this.periodMeta(period),
      lines,
      totals: {
        debitTotal: totalDebit.toString(),
        creditTotal: totalCredit.toString(),
        balanced: totalDebit === totalCredit,
      },
    };
  }

  public async generalLedger(accountCode?: string, periodId?: string) {
    if (!accountCode?.trim()) {
      throw new BadRequestException('accountCode is required');
    }
    const period = await this.resolvePeriod(periodId);
    const account = await this.findAccount(accountCode.trim());
    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: {
          accountingPeriodId: period.id,
          status: {
            in: [JournalEntryStatus.POSTED, JournalEntryStatus.VOIDED],
          },
        },
      },
      include: {
        journalEntry: true,
        account: true,
      },
      orderBy: [
        { journalEntry: { valueDate: 'asc' } },
        { lineNo: 'asc' },
      ],
    });

    let running = 0n;
    const entries = lines.map((line) => {
      const delta =
        account.accountType === AccountType.ASSET ||
        account.accountType === AccountType.EXPENSE
          ? line.debitAmount - line.creditAmount
          : line.creditAmount - line.debitAmount;
      running += delta;
      return {
        journalId: line.journalEntryId,
        entryNumber: line.journalEntry.entryNumber,
        status: line.journalEntry.status,
        valueDate: line.journalEntry.valueDate.toISOString(),
        lineNo: line.lineNo,
        memo: line.memo,
        debitAmount: line.debitAmount.toString(),
        creditAmount: line.creditAmount.toString(),
        runningBalance: running.toString(),
      };
    });

    return {
      success: true as const,
      reportType: 'general-ledger' as const,
      period: this.periodMeta(period),
      account: {
        code: account.code,
        name: account.name,
        accountType: account.accountType,
      },
      entries,
    };
  }

  public async balanceSheet(periodId?: string, asOf?: string) {
    const period = asOf
      ? await this.resolvePeriodForDate(new Date(asOf))
      : await this.resolvePeriod(periodId);
    const balances = await this.loadBalances(period.id);
    const section = (types: AccountType[]) =>
      balances
        .filter((b) => types.includes(b.account.accountType))
        .map((b) => ({
          accountCode: b.account.code,
          accountName: b.account.name,
          balance: b.closingBalance.toString(),
        }));

    const assets = section([AccountType.ASSET]);
    const liabilities = section([AccountType.LIABILITY]);
    const equity = section([AccountType.EQUITY]);
    const sum = (rows: { balance: string }[]) =>
      rows.reduce((s, r) => s + BigInt(r.balance), 0n);

    return {
      success: true as const,
      reportType: 'balance-sheet' as const,
      period: this.periodMeta(period),
      asOf: asOf ?? period.endsAt.toISOString(),
      assets,
      liabilities,
      equity,
      totals: {
        assets: sum(assets).toString(),
        liabilities: sum(liabilities).toString(),
        equity: sum(equity).toString(),
      },
    };
  }

  public async incomeStatement(periodId?: string) {
    const period = await this.resolvePeriod(periodId);
    const balances = await this.loadBalances(period.id);
    const revenue = balances
      .filter((b) => b.account.accountType === AccountType.REVENUE)
      .map((b) => ({
        accountCode: b.account.code,
        accountName: b.account.name,
        amount: b.closingBalance.toString(),
      }));
    const expenses = balances
      .filter((b) => b.account.accountType === AccountType.EXPENSE)
      .map((b) => ({
        accountCode: b.account.code,
        accountName: b.account.name,
        amount: b.closingBalance.toString(),
      }));
    const revenueTotal = revenue.reduce((s, r) => s + BigInt(r.amount), 0n);
    const expenseTotal = expenses.reduce((s, r) => s + BigInt(r.amount), 0n);

    return {
      success: true as const,
      reportType: 'income-statement' as const,
      period: this.periodMeta(period),
      revenue,
      expenses,
      totals: {
        revenue: revenueTotal.toString(),
        expenses: expenseTotal.toString(),
        netIncome: (revenueTotal - expenseTotal).toString(),
      },
    };
  }

  public async statementOfAccount(accountCode?: string, periodId?: string) {
    return this.generalLedger(accountCode, periodId);
  }

  /**
   * Accounts payable: rolls up CoA merchant/rider/organizer payable codes
   * (2000/2100/2200) plus a wallet liability snapshot (balance + hold) per
   * `WalletOwnerType`, since most payables live as wallet balances rather
   * than open CoA sub-ledger entries.
   */
  public async accountsPayable(periodId?: string) {
    const period = await this.resolvePeriod(periodId);
    const balances = await this.loadBalances(period.id);
    const codes: string[] = [
      CoaCodes.MERCHANT_PAYABLES,
      CoaCodes.RIDER_PAYABLES,
      CoaCodes.ORGANIZER_PAYABLES,
    ];
    const lines = balances
      .filter((b) => codes.includes(b.account.code))
      .map((b) => ({
        accountCode: b.account.code,
        accountName: b.account.name,
        balance: b.closingBalance.toString(),
      }));
    const accountsTotal = lines.reduce((s, l) => s + BigInt(l.balance), 0n);

    const grouped = await this.prisma.wallet.groupBy({
      by: ['ownerType'],
      where: { ownerType: { in: WALLET_PAYABLE_OWNER_TYPES } },
      _count: { _all: true },
      _sum: { balanceAmount: true, holdAmount: true },
    });
    const walletPayables = WALLET_PAYABLE_OWNER_TYPES.map((ownerType) => {
      const row = grouped.find((g) => g.ownerType === ownerType);
      const availableTotal = row?._sum.balanceAmount ?? 0n;
      const heldTotal = row?._sum.holdAmount ?? 0n;
      return {
        ownerType,
        walletCount: row?._count._all ?? 0,
        availableTotal: availableTotal.toString(),
        heldTotal: heldTotal.toString(),
        total: (availableTotal + heldTotal).toString(),
      };
    });
    const walletsTotal = walletPayables.reduce((s, w) => s + BigInt(w.total), 0n);

    return {
      success: true as const,
      reportType: 'accounts-payable' as const,
      period: this.periodMeta(period),
      lines,
      walletPayables,
      totals: {
        accountsTotal: accountsTotal.toString(),
        walletsTotal: walletsTotal.toString(),
        grandTotal: (accountsTotal + walletsTotal).toString(),
      },
    };
  }

  /**
   * The platform has no trade AR ledger — customers pay up-front. This
   * ships a cash & escrow position report instead (codes 1000/1200/1300),
   * with the customer-wallet liability (1100) surfaced as a contra note
   * so it is never mistaken for a receivable.
   */
  public async accountsReceivable(periodId?: string) {
    const period = await this.resolvePeriod(periodId);
    const balances = await this.loadBalances(period.id);
    const codes: string[] = [
      CoaCodes.PLATFORM_CASH,
      CoaCodes.ESCROW_COMMERCE,
      CoaCodes.ESCROW_RIDES,
    ];
    const lines = balances
      .filter((b) => codes.includes(b.account.code))
      .map((b) => ({
        accountCode: b.account.code,
        accountName: b.account.name,
        balance: b.closingBalance.toString(),
      }));
    const total = lines.reduce((s, l) => s + BigInt(l.balance), 0n);
    const customerWallets = balances.find(
      (b) => b.account.code === CoaCodes.CUSTOMER_WALLETS,
    );

    return {
      success: true as const,
      reportType: 'accounts-receivable' as const,
      period: this.periodMeta(period),
      notes:
        'Platform has no trade AR; this report shows cash clearing and escrow liability positions.',
      lines,
      customerWalletsContra: customerWallets
        ? {
            accountCode: customerWallets.account.code,
            accountName: customerWallets.account.name,
            balance: customerWallets.closingBalance.toString(),
          }
        : null,
      totals: {
        total: total.toString(),
      },
    };
  }

  /**
   * Aggregates commission/fee revenue directly from `Order` rows in the
   * period date range (orders have no `paidAt`, so `createdAt` is used;
   * unpaid/cancelled/failed orders are excluded since they never realise
   * commission), grouped by `moduleType` (vertical).
   */
  public async commissionReport(periodId?: string) {
    const period = await this.resolvePeriod(periodId);
    const grouped = await this.prisma.order.groupBy({
      by: ['moduleType'],
      where: {
        createdAt: { gte: period.startsAt, lt: period.endsAt },
        status: { notIn: COMMISSION_EXCLUDED_STATUSES },
      },
      _count: { _all: true },
      _sum: {
        platformCommissionAmount: true,
        merchantCommissionAmount: true,
        serviceFeeAmount: true,
        deliveryFeeAmount: true,
      },
    });

    const lines = grouped.map((g) => ({
      module: g.moduleType,
      orderCount: g._count._all,
      platformCommission: (g._sum.platformCommissionAmount ?? 0n).toString(),
      merchantCommission: (g._sum.merchantCommissionAmount ?? 0n).toString(),
      serviceFee: (g._sum.serviceFeeAmount ?? 0n).toString(),
      deliveryFee: (g._sum.deliveryFeeAmount ?? 0n).toString(),
    }));

    const totals = lines.reduce(
      (acc, l) => ({
        orderCount: acc.orderCount + l.orderCount,
        platformCommission: acc.platformCommission + BigInt(l.platformCommission),
        merchantCommission: acc.merchantCommission + BigInt(l.merchantCommission),
        serviceFee: acc.serviceFee + BigInt(l.serviceFee),
        deliveryFee: acc.deliveryFee + BigInt(l.deliveryFee),
      }),
      {
        orderCount: 0,
        platformCommission: 0n,
        merchantCommission: 0n,
        serviceFee: 0n,
        deliveryFee: 0n,
      },
    );

    return {
      success: true as const,
      reportType: 'commission' as const,
      period: this.periodMeta(period),
      lines,
      totals: {
        orderCount: totals.orderCount,
        platformCommission: totals.platformCommission.toString(),
        merchantCommission: totals.merchantCommission.toString(),
        serviceFee: totals.serviceFee.toString(),
        deliveryFee: totals.deliveryFee.toString(),
      },
    };
  }

  /**
   * Lists settlement batches created or processed within the period, plus
   * a status breakdown. `SettlementBatchStatus` has no APPROVED state —
   * approval is tracked on `externalRef` (see `SettlementService`).
   */
  public async settlementReport(periodId?: string) {
    const period = await this.resolvePeriod(periodId);
    const batches = await this.prisma.settlementBatch.findMany({
      where: {
        OR: [
          { createdAt: { gte: period.startsAt, lt: period.endsAt } },
          { processedAt: { gte: period.startsAt, lt: period.endsAt } },
        ],
      },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });

    const lines = batches.map((b) => ({
      id: b.id,
      batchNumber: b.batchNumber,
      status: b.status,
      beneficiaryType: b.beneficiaryType,
      currency: b.currency,
      totalAmount: b.totalAmount.toString(),
      itemCount: b.items.length,
      scheduledFor: b.scheduledFor?.toISOString() ?? null,
      processedAt: b.processedAt?.toISOString() ?? null,
      createdAt: b.createdAt.toISOString(),
    }));

    const byStatusMap = new Map<string, { count: number; amount: bigint }>();
    for (const b of batches) {
      const entry = byStatusMap.get(b.status) ?? { count: 0, amount: 0n };
      entry.count += 1;
      entry.amount += b.totalAmount;
      byStatusMap.set(b.status, entry);
    }
    const byStatus = Array.from(byStatusMap.entries()).map(([status, v]) => ({
      status,
      count: v.count,
      amount: v.amount.toString(),
    }));
    const totalAmount = batches.reduce((s, b) => s + b.totalAmount, 0n);

    return {
      success: true as const,
      reportType: 'settlement' as const,
      period: this.periodMeta(period),
      batches: lines,
      totals: {
        batchCount: batches.length,
        totalAmount: totalAmount.toString(),
        byStatus,
      },
    };
  }

  /**
   * Thin cross-cutting dashboard for `/v1/admin/accounting/finance-overview`:
   * wallet totals by owner type, open escrow position, pending settlement
   * batches, and the latest open period's net income.
   */
  public async financeOverview() {
    const walletOwnerTypes: WalletOwnerType[] = [
      WalletOwnerType.CUSTOMER,
      WalletOwnerType.MERCHANT,
      WalletOwnerType.RIDER,
      WalletOwnerType.ORGANIZER,
      WalletOwnerType.PLATFORM,
    ];
    const [walletGrouped, escrowAgg, pendingBatchAgg, openPeriod] =
      await Promise.all([
        this.prisma.wallet.groupBy({
          by: ['ownerType'],
          _count: { _all: true },
          _sum: { balanceAmount: true, holdAmount: true },
        }),
        this.prisma.escrowHold.aggregate({
          where: { status: EscrowStatus.HELD },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        this.prisma.settlementBatch.aggregate({
          where: {
            status: {
              in: [SettlementBatchStatus.PENDING, SettlementBatchStatus.PROCESSING],
            },
          },
          _count: { _all: true },
          _sum: { totalAmount: true },
        }),
        this.prisma.accountingPeriod.findFirst({
          where: { status: 'OPEN' },
          orderBy: { startsAt: 'desc' },
        }),
      ]);

    const wallets = walletOwnerTypes.map((ownerType) => {
      const row = walletGrouped.find((g) => g.ownerType === ownerType);
      const availableTotal = row?._sum.balanceAmount ?? 0n;
      const heldTotal = row?._sum.holdAmount ?? 0n;
      return {
        ownerType,
        walletCount: row?._count._all ?? 0,
        availableTotal: availableTotal.toString(),
        heldTotal: heldTotal.toString(),
        total: (availableTotal + heldTotal).toString(),
      };
    });

    let latestPeriod: { id: string; name: string; netIncome: string } | null =
      null;
    if (openPeriod) {
      const income = await this.incomeStatement(openPeriod.id);
      latestPeriod = {
        id: openPeriod.id,
        name: openPeriod.name,
        netIncome: income.totals.netIncome,
      };
    }

    return {
      success: true as const,
      wallets,
      escrow: {
        heldCount: escrowAgg._count._all,
        heldAmount: (escrowAgg._sum.amount ?? 0n).toString(),
      },
      settlements: {
        pendingBatchCount: pendingBatchAgg._count._all,
        pendingAmount: (pendingBatchAgg._sum.totalAmount ?? 0n).toString(),
      },
      latestPeriod,
    };
  }

  public async exportReport(
    reportType: ReportType,
    format: ExportFormat,
    query: {
      periodId?: string;
      asOf?: string;
      accountCode?: string;
    },
  ): Promise<{
    filename: string;
    contentType: string;
    buffer: Buffer;
  }> {
    const data = await this.buildReport(reportType, query);
    const sheetName = reportType;
    const rows = this.flattenReportRows(reportType, data);
    const workbook: SpreadsheetWorkbook = {
      sheets: [{ name: sheetName, rows }],
    };

    if (format === 'csv') {
      const buffer = await this.documents.exportSpreadsheet(workbook, 'csv');
      return {
        filename: `${reportType}.csv`,
        contentType: 'text/csv',
        buffer,
      };
    }
    if (format === 'xlsx') {
      const buffer = await this.documents.exportSpreadsheet(workbook, 'xlsx');
      return {
        filename: `${reportType}.xlsx`,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer,
      };
    }

    const buffer = await this.documents.generatePdf({
      metadata: { title: reportType },
      content: {
        sections: [
          {
            heading: reportType,
            paragraphs: [
              `Period: ${JSON.stringify(data.period ?? {})}`,
              ...rows.slice(0, 80).map((row) => row.map(String).join(' | ')),
            ],
          },
        ],
      },
    });
    return {
      filename: `${reportType}.pdf`,
      contentType: 'application/pdf',
      buffer,
    };
  }

  private async buildReport(
    reportType: ReportType,
    query: {
      periodId?: string;
      asOf?: string;
      accountCode?: string;
    },
  ) {
    switch (reportType) {
      case 'trial-balance':
        return this.trialBalance(query.periodId);
      case 'general-ledger':
        return this.generalLedger(query.accountCode, query.periodId);
      case 'balance-sheet':
        return this.balanceSheet(query.periodId, query.asOf);
      case 'income-statement':
      case 'p-and-l':
        return this.incomeStatement(query.periodId);
      case 'account-statement':
        return this.statementOfAccount(query.accountCode, query.periodId);
      case 'accounts-payable':
        return this.accountsPayable(query.periodId);
      case 'accounts-receivable':
        return this.accountsReceivable(query.periodId);
      case 'commission':
        return this.commissionReport(query.periodId);
      case 'settlement':
        return this.settlementReport(query.periodId);
      default:
        throw new BadRequestException(`Unknown report type ${reportType}`);
    }
  }

  private flattenReportRows(
    reportType: ReportType,
    data: Awaited<ReturnType<FinancialReportsService['buildReport']>>,
  ): Array<Array<string | number | null>> {
    if (data.reportType === 'trial-balance') {
      return [
        ['Account', 'Name', 'Type', 'Debit', 'Credit', 'Closing'],
        ...data.lines.map((l) => [
          l.accountCode,
          l.accountName,
          l.accountType,
          l.debitTotal,
          l.creditTotal,
          l.closingBalance,
        ]),
      ];
    }
    if (
      (reportType === 'general-ledger' || reportType === 'account-statement') &&
      'entries' in data
    ) {
      return [
        ['Entry', 'Date', 'Debit', 'Credit', 'Running', 'Memo'],
        ...data.entries.map((e) => [
          e.entryNumber,
          e.valueDate,
          e.debitAmount,
          e.creditAmount,
          e.runningBalance,
          e.memo ?? '',
        ]),
      ];
    }
    if (data.reportType === 'balance-sheet') {
      return [
        ['Section', 'Account', 'Name', 'Balance'],
        ...data.assets.map((a) => [
          'ASSET',
          a.accountCode,
          a.accountName,
          a.balance,
        ]),
        ...data.liabilities.map((a) => [
          'LIABILITY',
          a.accountCode,
          a.accountName,
          a.balance,
        ]),
        ...data.equity.map((a) => [
          'EQUITY',
          a.accountCode,
          a.accountName,
          a.balance,
        ]),
      ];
    }
    if (data.reportType === 'income-statement') {
      return [
        ['Section', 'Account', 'Name', 'Amount'],
        ...data.revenue.map((a) => [
          'REVENUE',
          a.accountCode,
          a.accountName,
          a.amount,
        ]),
        ...data.expenses.map((a) => [
          'EXPENSE',
          a.accountCode,
          a.accountName,
          a.amount,
        ]),
      ];
    }
    if (data.reportType === 'accounts-payable') {
      return [
        ['Section', 'Code/OwnerType', 'Name', 'Available', 'Held', 'Balance'],
        ...data.lines.map((l) => [
          'CoA',
          l.accountCode,
          l.accountName,
          '',
          '',
          l.balance,
        ]),
        ...data.walletPayables.map((w) => [
          'Wallet',
          w.ownerType,
          'Wallet Payables',
          w.availableTotal,
          w.heldTotal,
          w.total,
        ]),
      ];
    }
    if (data.reportType === 'accounts-receivable') {
      return [
        ['Account', 'Name', 'Balance'],
        ...data.lines.map((l) => [l.accountCode, l.accountName, l.balance]),
        ...(data.customerWalletsContra
          ? [
              [
                `${data.customerWalletsContra.accountCode} (contra)`,
                data.customerWalletsContra.accountName,
                data.customerWalletsContra.balance,
              ],
            ]
          : []),
      ];
    }
    if (data.reportType === 'commission') {
      return [
        [
          'Module',
          'Orders',
          'PlatformCommission',
          'MerchantCommission',
          'ServiceFee',
          'DeliveryFee',
        ],
        ...data.lines.map((l) => [
          l.module,
          l.orderCount,
          l.platformCommission,
          l.merchantCommission,
          l.serviceFee,
          l.deliveryFee,
        ]),
      ];
    }
    if (data.reportType === 'settlement') {
      return [
        [
          'Batch',
          'Status',
          'BeneficiaryType',
          'Currency',
          'TotalAmount',
          'Items',
          'ProcessedAt',
        ],
        ...data.batches.map((b) => [
          b.batchNumber,
          b.status,
          b.beneficiaryType,
          b.currency,
          b.totalAmount,
          b.itemCount,
          b.processedAt ?? '',
        ]),
      ];
    }
    return [['report', reportType]];
  }

  private async loadBalances(periodId: string) {
    return this.prisma.accountBalance.findMany({
      where: { accountingPeriodId: periodId },
      include: { account: true },
      orderBy: { account: { code: 'asc' } },
    });
  }

  private async findAccount(code: string): Promise<Account> {
    const chart = await this.prisma.chartOfAccounts.findUnique({
      where: { code: DEFAULT_CHART_CODE },
    });
    if (!chart) {
      throw new NotFoundException(
        `Chart ${DEFAULT_CHART_CODE} not found — run seed 002`,
      );
    }
    const account = await this.prisma.account.findUnique({
      where: {
        chartOfAccountsId_code: {
          chartOfAccountsId: chart.id,
          code,
        },
      },
    });
    if (!account) {
      throw new NotFoundException(`Account ${code} not found`);
    }
    return account;
  }

  private async resolvePeriod(periodId?: string): Promise<AccountingPeriod> {
    if (periodId) {
      const period = await this.prisma.accountingPeriod.findUnique({
        where: { id: periodId },
      });
      if (!period) {
        throw new NotFoundException(`Accounting period ${periodId} not found`);
      }
      return period;
    }
    const open = await this.prisma.accountingPeriod.findFirst({
      where: { status: 'OPEN' },
      orderBy: { startsAt: 'desc' },
    });
    if (!open) {
      throw new NotFoundException(
        'No accounting period found; call POST admin/accounting/periods/ensure',
      );
    }
    return open;
  }

  private async resolvePeriodForDate(at: Date): Promise<AccountingPeriod> {
    if (Number.isNaN(at.getTime())) {
      throw new BadRequestException('Invalid asOf date');
    }
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        startsAt: { lte: at },
        endsAt: { gt: at },
      },
      orderBy: { startsAt: 'desc' },
    });
    if (!period) {
      throw new NotFoundException(
        `No accounting period covers ${at.toISOString()}`,
      );
    }
    return period;
  }

  private periodMeta(period: AccountingPeriod) {
    return {
      id: period.id,
      name: period.name,
      startsAt: period.startsAt.toISOString(),
      endsAt: period.endsAt.toISOString(),
      status: period.status,
    };
  }
}
