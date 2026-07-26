import {
  SettlementBatchStatus,
  SettlementStatus,
  WalletOwnerType,
  WalletTransactionType,
} from '@prisma/client';
import { FinanceDashboardService } from '../use-cases/finance-dashboard.service';
import type { WalletPublicView, WalletService } from '../use-cases/wallet.service';
import type { PrismaService } from '../../../database/prisma/prisma.service';

const MERCHANT_ID = '33333333-3333-4333-8333-333333333333';
const WALLET_ID = '44444444-4444-4444-8444-444444444444';

function walletRow() {
  return {
    id: WALLET_ID,
    ownerType: WalletOwnerType.MERCHANT,
    ownerId: MERCHANT_ID,
    userId: null,
    merchantId: MERCHANT_ID,
    riderId: null,
    organizerId: null,
    currency: 'KES',
    balanceAmount: 9000n,
    holdAmount: 500n,
    version: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function walletView(): WalletPublicView {
  return {
    id: WALLET_ID,
    currency: 'KES',
    ownerType: WalletOwnerType.MERCHANT,
    ownerId: MERCHANT_ID,
    available: 9000,
    held: 500,
    pending: 500,
    total: 9500,
    balance: 9000,
    holdAmount: 500,
    version: 3,
  };
}

describe('FinanceDashboardService', () => {
  let prisma: {
    walletTransaction: { findMany: jest.Mock; groupBy: jest.Mock };
    settlementItem: { findMany: jest.Mock };
    settlement: { findMany: jest.Mock };
    escrowHold: { aggregate: jest.Mock };
  };
  let wallets: { getOrCreate: jest.Mock; getById: jest.Mock };
  let service: FinanceDashboardService;

  beforeEach(() => {
    prisma = {
      walletTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      settlementItem: { findMany: jest.fn().mockResolvedValue([]) },
      settlement: { findMany: jest.fn().mockResolvedValue([]) },
      escrowHold: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { amount: 0n },
        }),
      },
    };
    wallets = {
      getOrCreate: jest.fn().mockResolvedValue(walletRow()),
      getById: jest.fn().mockResolvedValue(walletView()),
    };
    service = new FinanceDashboardService(
      prisma as unknown as PrismaService,
      wallets as unknown as WalletService,
    );
  });

  describe('getDashboard', () => {
    it('returns wallet snapshot, earnings, settlements, and escrow shape', async () => {
      prisma.walletTransaction.findMany.mockResolvedValue([
        {
          id: 't1',
          type: WalletTransactionType.CREDIT,
          debitAmount: 0n,
          creditAmount: 1500n,
          balanceAfter: 9000n,
          reference: 'order:1',
          description: 'Order payout',
          createdAt: new Date('2026-07-20T00:00:00.000Z'),
        },
      ]);
      prisma.walletTransaction.groupBy.mockResolvedValue([
        {
          type: WalletTransactionType.CREDIT,
          _sum: { creditAmount: 5000n, debitAmount: 0n },
        },
        {
          type: WalletTransactionType.DEBIT,
          _sum: { creditAmount: 0n, debitAmount: 2000n },
        },
      ]);
      prisma.settlementItem.findMany.mockResolvedValue([
        { id: 'i1', walletId: WALLET_ID, amount: 800n, currency: 'KES' },
      ]);
      prisma.settlement.findMany.mockResolvedValue([
        { id: 's1', walletId: WALLET_ID, amount: 1200n, status: SettlementStatus.COMPLETED },
        { id: 's2', walletId: WALLET_ID, amount: 300n, status: SettlementStatus.COMPLETED },
      ]);
      prisma.escrowHold.aggregate.mockResolvedValue({
        _count: { _all: 2 },
        _sum: { amount: 4000n },
      });

      const result = await service.getDashboard(WalletOwnerType.MERCHANT, MERCHANT_ID);

      expect(wallets.getOrCreate).toHaveBeenCalledWith(
        WalletOwnerType.MERCHANT,
        MERCHANT_ID,
      );
      expect(result.success).toBe(true);
      expect(result.wallet).toEqual(walletView());
      expect(result.recentTransactions).toHaveLength(1);
      expect(result.recentTransactions[0]).toMatchObject({
        id: 't1',
        creditAmount: 1500,
        debitAmount: 0,
      });
      expect(result.earnings).toEqual({
        credits: 5000,
        debits: 2000,
        net: 3000,
        currency: 'KES',
      });
      expect(result.settlements).toEqual({
        pendingBatchItems: 1,
        pendingAmount: 800,
        completedPayouts: 2,
        completedAmount: 1500,
      });
      expect(result.escrow).toEqual({ heldCount: 2, heldAmount: 4000 });

      const settlementItemArgs = prisma.settlementItem.findMany.mock.calls[0][0];
      expect(settlementItemArgs.where.walletId).toBe(WALLET_ID);
      expect(settlementItemArgs.where.batch.status.in).toEqual(
        expect.arrayContaining([
          SettlementBatchStatus.PENDING,
          SettlementBatchStatus.PROCESSING,
        ]),
      );
    });

    it('defaults earnings/settlements/escrow to zero when there is no activity', async () => {
      const result = await service.getDashboard(WalletOwnerType.RIDER, MERCHANT_ID);
      expect(result.earnings).toEqual({
        credits: 0,
        debits: 0,
        net: 0,
        currency: 'KES',
      });
      expect(result.settlements).toEqual({
        pendingBatchItems: 0,
        pendingAmount: 0,
        completedPayouts: 0,
        completedAmount: 0,
      });
      expect(result.escrow).toEqual({ heldCount: 0, heldAmount: 0 });
    });
  });

  describe('exportStatement', () => {
    it('exports current-month transactions as csv', async () => {
      prisma.walletTransaction.findMany.mockResolvedValue([
        {
          id: 't1',
          type: WalletTransactionType.CREDIT,
          debitAmount: 0n,
          creditAmount: 1000n,
          balanceAfter: 1000n,
          reference: 'ref-1',
          description: 'desc',
          createdAt: new Date('2026-07-05T00:00:00.000Z'),
        },
      ]);

      const result = await service.exportStatement(
        WalletOwnerType.MERCHANT,
        MERCHANT_ID,
        'csv',
      );

      expect(result.filename).toBe('wallet-statement.csv');
      expect(result.contentType).toBe('text/csv');
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.buffer.toString('utf-8')).toContain('ref-1');
    });
  });
});
