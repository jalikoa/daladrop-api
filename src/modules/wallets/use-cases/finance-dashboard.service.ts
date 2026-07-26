import { Injectable } from '@nestjs/common';
import {
  EscrowStatus,
  SettlementBatchStatus,
  SettlementStatus,
  WalletOwnerType,
  WalletTransactionType,
  type WalletTransaction,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { kesFromBigInt } from '../../../shared/money';
import { DocumentService } from '../../../platform/documents/document.service';
import type { SpreadsheetWorkbook } from '../../../platform/documents/interfaces/spreadsheet-parser.interface';
import { WalletService } from './wallet.service';

const COMPLETED_SETTLEMENT_LOOKBACK_DAYS = 90;

export type StatementExportFormat = 'csv' | 'xlsx';

function toRecentTxnView(row: WalletTransaction) {
  return {
    id: row.id,
    type: row.type,
    debitAmount: Number(row.debitAmount),
    creditAmount: Number(row.creditAmount),
    balanceAfter: Number(row.balanceAfter),
    reference: row.reference,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  };
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Africa/Nairobi is a fixed UTC+3 offset (no DST), so the wall-clock month
 * start can be computed without a timezone library: take "now" shifted by
 * +3h to read Nairobi's calendar date, then convert that midnight back to
 * its UTC instant (Nairobi 00:00 == UTC-3h on the same calendar day).
 */
function currentMonthStartNairobi(now: Date = new Date()): Date {
  const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
  const nairobiNow = new Date(now.getTime() + NAIROBI_OFFSET_MS);
  const year = nairobiNow.getUTCFullYear();
  const month = nairobiNow.getUTCMonth();
  return new Date(Date.UTC(year, month, 1, 0, 0, 0) - NAIROBI_OFFSET_MS);
}

@Injectable()
export class FinanceDashboardService {
  private readonly documents = new DocumentService();

  public constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
  ) {}

  /**
   * Merchant/rider finance dashboard: wallet snapshot, recent activity,
   * current-calendar-month (Africa/Nairobi) earnings, pending/completed
   * settlement summary, and open escrow held against the owner.
   */
  public async getDashboard(ownerType: WalletOwnerType, ownerId: string) {
    const wallet = await this.wallets.getOrCreate(ownerType, ownerId);
    const walletView = await this.wallets.getById(wallet.id);
    const periodStart = currentMonthStartNairobi();

    const [recentTxns, earningsGrouped, pendingItems, completedSettlements, escrowAgg] =
      await Promise.all([
        this.prisma.walletTransaction.findMany({
          where: { walletId: wallet.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        this.prisma.walletTransaction.groupBy({
          by: ['type'],
          where: {
            walletId: wallet.id,
            createdAt: { gte: periodStart },
            type: { in: [WalletTransactionType.CREDIT, WalletTransactionType.DEBIT] },
          },
          _sum: { creditAmount: true, debitAmount: true },
        }),
        this.prisma.settlementItem.findMany({
          where: {
            walletId: wallet.id,
            batch: {
              status: {
                in: [SettlementBatchStatus.PENDING, SettlementBatchStatus.PROCESSING],
              },
            },
          },
        }),
        this.prisma.settlement.findMany({
          where: {
            walletId: wallet.id,
            status: SettlementStatus.COMPLETED,
            processedAt: { gte: daysAgo(COMPLETED_SETTLEMENT_LOOKBACK_DAYS) },
          },
        }),
        this.prisma.escrowHold.aggregate({
          where: {
            beneficiaryType: ownerType,
            beneficiaryId: ownerId,
            status: EscrowStatus.HELD,
          },
          _count: { _all: true },
          _sum: { amount: true },
        }),
      ]);

    const creditRow = earningsGrouped.find(
      (r) => r.type === WalletTransactionType.CREDIT,
    );
    const debitRow = earningsGrouped.find(
      (r) => r.type === WalletTransactionType.DEBIT,
    );
    const credits = Number(
      kesFromBigInt(creditRow?._sum.creditAmount ?? 0n).amount,
    );
    const debits = Number(kesFromBigInt(debitRow?._sum.debitAmount ?? 0n).amount);

    const pendingAmount = pendingItems.reduce((s, i) => s + i.amount, 0n);
    const completedAmount = completedSettlements.reduce(
      (s, settlement) => s + settlement.amount,
      0n,
    );

    return {
      success: true as const,
      wallet: walletView,
      recentTransactions: recentTxns.map(toRecentTxnView),
      earnings: {
        credits,
        debits,
        net: credits - debits,
        currency: 'KES',
      },
      settlements: {
        pendingBatchItems: pendingItems.length,
        pendingAmount: Number(kesFromBigInt(pendingAmount).amount),
        completedPayouts: completedSettlements.length,
        completedAmount: Number(kesFromBigInt(completedAmount).amount),
      },
      escrow: {
        heldCount: escrowAgg._count._all,
        heldAmount: Number(kesFromBigInt(escrowAgg._sum.amount ?? 0n).amount),
      },
    };
  }

  /** Exports the current-month wallet statement (transactions) as csv/xlsx via `DocumentService`. */
  public async exportStatement(
    ownerType: WalletOwnerType,
    ownerId: string,
    format: StatementExportFormat,
  ): Promise<{ filename: string; contentType: string; buffer: Buffer }> {
    const wallet = await this.wallets.getOrCreate(ownerType, ownerId);
    const periodStart = currentMonthStartNairobi();
    const txns = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id, createdAt: { gte: periodStart } },
      orderBy: { createdAt: 'asc' },
    });

    const rows: Array<Array<string | number | null>> = [
      ['Date', 'Type', 'Debit', 'Credit', 'BalanceAfter', 'Reference', 'Description'],
      ...txns.map((t) => [
        t.createdAt.toISOString(),
        t.type,
        t.debitAmount.toString(),
        t.creditAmount.toString(),
        t.balanceAfter.toString(),
        t.reference ?? '',
        t.description ?? '',
      ]),
    ];
    const workbook: SpreadsheetWorkbook = {
      sheets: [{ name: 'statement', rows }],
    };
    const buffer = await this.documents.exportSpreadsheet(workbook, format);
    const contentType =
      format === 'csv'
        ? 'text/csv'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return { filename: `wallet-statement.${format}`, contentType, buffer };
  }
}
