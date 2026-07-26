import {
  EscrowStatus,
  ModuleOrderStatus,
  ModuleType,
  SettlementBatchStatus,
  WalletOwnerType,
} from '@prisma/client';
import { CoaCodes } from '../constants/coa-codes';
import { FinancialReportsService } from '../use-cases/financial-reports.service';
import type { PrismaService } from '../../../database/prisma/prisma.service';

const PERIOD_ID = '22222222-2222-4222-8222-222222222222';

function period() {
  return {
    id: PERIOD_ID,
    fiscalPeriodId: 'fy-1',
    name: '2026-07',
    startsAt: new Date('2026-07-01T00:00:00.000Z'),
    endsAt: new Date('2026-08-01T00:00:00.000Z'),
    status: 'OPEN',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function accountBalanceRow(
  code: string,
  name: string,
  closingBalance: bigint,
) {
  return {
    accountingPeriodId: PERIOD_ID,
    debitTotal: closingBalance > 0n ? closingBalance : 0n,
    creditTotal: closingBalance < 0n ? -closingBalance : 0n,
    closingBalance,
    account: { code, name, accountType: 'ASSET' },
  };
}

describe('FinancialReportsService', () => {
  let prisma: {
    accountBalance: { findMany: jest.Mock };
    accountingPeriod: { findFirst: jest.Mock; findUnique: jest.Mock };
    wallet: { groupBy: jest.Mock };
    order: { groupBy: jest.Mock };
    settlementBatch: { findMany: jest.Mock; aggregate: jest.Mock };
    escrowHold: { aggregate: jest.Mock };
  };
  let service: FinancialReportsService;

  beforeEach(() => {
    prisma = {
      accountBalance: { findMany: jest.fn().mockResolvedValue([]) },
      accountingPeriod: {
        findFirst: jest.fn().mockResolvedValue(period()),
        findUnique: jest.fn().mockResolvedValue(period()),
      },
      wallet: { groupBy: jest.fn().mockResolvedValue([]) },
      order: { groupBy: jest.fn().mockResolvedValue([]) },
      settlementBatch: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { totalAmount: 0n },
        }),
      },
      escrowHold: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { amount: 0n },
        }),
      },
    };
    service = new FinancialReportsService(prisma as unknown as PrismaService);
  });

  describe('accountsPayable', () => {
    it('rolls up payable CoA codes and wallet liability snapshot', async () => {
      prisma.accountBalance.findMany.mockResolvedValue([
        accountBalanceRow(CoaCodes.MERCHANT_PAYABLES, 'Merchant Payables', 5000n),
        accountBalanceRow(CoaCodes.RIDER_PAYABLES, 'Rider Payables', 2000n),
        accountBalanceRow(CoaCodes.ORGANIZER_PAYABLES, 'Organizer Payables', 0n),
        accountBalanceRow(CoaCodes.PLATFORM_CASH, 'Platform Cash', 9999n),
      ]);
      prisma.wallet.groupBy.mockResolvedValue([
        {
          ownerType: WalletOwnerType.MERCHANT,
          _count: { _all: 3 },
          _sum: { balanceAmount: 4000n, holdAmount: 500n },
        },
        {
          ownerType: WalletOwnerType.RIDER,
          _count: { _all: 2 },
          _sum: { balanceAmount: 1000n, holdAmount: 0n },
        },
      ]);

      const result = await service.accountsPayable();

      expect(result.reportType).toBe('accounts-payable');
      expect(result.lines).toHaveLength(3);
      expect(result.walletPayables).toEqual([
        {
          ownerType: WalletOwnerType.MERCHANT,
          walletCount: 3,
          availableTotal: '4000',
          heldTotal: '500',
          total: '4500',
        },
        {
          ownerType: WalletOwnerType.RIDER,
          walletCount: 2,
          availableTotal: '1000',
          heldTotal: '0',
          total: '1000',
        },
        {
          ownerType: WalletOwnerType.ORGANIZER,
          walletCount: 0,
          availableTotal: '0',
          heldTotal: '0',
          total: '0',
        },
      ]);
      expect(result.totals).toEqual({
        accountsTotal: '7000',
        walletsTotal: '5500',
        grandTotal: '12500',
      });
    });
  });

  describe('accountsReceivable', () => {
    it('reports cash & escrow position labeled as not trade AR', async () => {
      prisma.accountBalance.findMany.mockResolvedValue([
        accountBalanceRow(CoaCodes.PLATFORM_CASH, 'Platform Cash', 10000n),
        accountBalanceRow(CoaCodes.ESCROW_COMMERCE, 'Escrow Commerce', 3000n),
        accountBalanceRow(CoaCodes.ESCROW_RIDES, 'Escrow Rides', 500n),
        accountBalanceRow(CoaCodes.CUSTOMER_WALLETS, 'Customer Wallets', 1200n),
      ]);

      const result = await service.accountsReceivable();

      expect(result.reportType).toBe('accounts-receivable');
      expect(result.notes).toMatch(/no trade AR/);
      expect(result.lines).toHaveLength(3);
      expect(result.customerWalletsContra).toMatchObject({
        accountCode: CoaCodes.CUSTOMER_WALLETS,
        balance: '1200',
      });
      expect(result.totals.total).toBe('13500');
    });

    it('omits the contra note when the customer wallet account has no balance row', async () => {
      prisma.accountBalance.findMany.mockResolvedValue([
        accountBalanceRow(CoaCodes.PLATFORM_CASH, 'Platform Cash', 1000n),
      ]);

      const result = await service.accountsReceivable();
      expect(result.customerWalletsContra).toBeNull();
    });
  });

  describe('commissionReport', () => {
    it('aggregates commission/fee fields grouped by module within the period', async () => {
      prisma.order.groupBy.mockResolvedValue([
        {
          moduleType: ModuleType.FOOD,
          _count: { _all: 10 },
          _sum: {
            platformCommissionAmount: 1000n,
            merchantCommissionAmount: 2000n,
            serviceFeeAmount: 300n,
            deliveryFeeAmount: 400n,
          },
        },
        {
          moduleType: ModuleType.GAS,
          _count: { _all: 4 },
          _sum: {
            platformCommissionAmount: 200n,
            merchantCommissionAmount: 100n,
            serviceFeeAmount: 50n,
            deliveryFeeAmount: 60n,
          },
        },
      ]);

      const result = await service.commissionReport();

      expect(prisma.order.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['moduleType'],
          where: expect.objectContaining({
            status: {
              notIn: [
                ModuleOrderStatus.PENDING_PAYMENT,
                ModuleOrderStatus.CANCELLED,
                ModuleOrderStatus.FAILED,
              ],
            },
          }),
        }),
      );
      expect(result.lines).toEqual([
        {
          module: ModuleType.FOOD,
          orderCount: 10,
          platformCommission: '1000',
          merchantCommission: '2000',
          serviceFee: '300',
          deliveryFee: '400',
        },
        {
          module: ModuleType.GAS,
          orderCount: 4,
          platformCommission: '200',
          merchantCommission: '100',
          serviceFee: '50',
          deliveryFee: '60',
        },
      ]);
      expect(result.totals).toEqual({
        orderCount: 14,
        platformCommission: '1200',
        merchantCommission: '2100',
        serviceFee: '350',
        deliveryFee: '460',
      });
    });
  });

  describe('settlementReport', () => {
    it('lists batches in the period with a status breakdown', async () => {
      prisma.settlementBatch.findMany.mockResolvedValue([
        {
          id: 'b1',
          batchNumber: 'SB-1',
          status: SettlementBatchStatus.COMPLETED,
          beneficiaryType: WalletOwnerType.MERCHANT,
          currency: 'KES',
          totalAmount: 5000n,
          scheduledFor: null,
          processedAt: new Date('2026-07-10T00:00:00.000Z'),
          createdAt: new Date('2026-07-09T00:00:00.000Z'),
          items: [{}, {}],
        },
        {
          id: 'b2',
          batchNumber: 'SB-2',
          status: SettlementBatchStatus.PENDING,
          beneficiaryType: WalletOwnerType.RIDER,
          currency: 'KES',
          totalAmount: 1500n,
          scheduledFor: new Date('2026-07-20T00:00:00.000Z'),
          processedAt: null,
          createdAt: new Date('2026-07-15T00:00:00.000Z'),
          items: [{}],
        },
      ]);

      const result = await service.settlementReport();

      expect(result.batches).toHaveLength(2);
      expect(result.batches[0]).toMatchObject({ batchNumber: 'SB-1', itemCount: 2 });
      expect(result.totals.batchCount).toBe(2);
      expect(result.totals.totalAmount).toBe('6500');
      expect(result.totals.byStatus).toEqual(
        expect.arrayContaining([
          { status: SettlementBatchStatus.COMPLETED, count: 1, amount: '5000' },
          { status: SettlementBatchStatus.PENDING, count: 1, amount: '1500' },
        ]),
      );
    });
  });

  describe('financeOverview', () => {
    it('aggregates wallets, escrow, pending settlements and latest net income', async () => {
      prisma.wallet.groupBy.mockResolvedValue([
        {
          ownerType: WalletOwnerType.MERCHANT,
          _count: { _all: 5 },
          _sum: { balanceAmount: 10000n, holdAmount: 1000n },
        },
      ]);
      prisma.escrowHold.aggregate.mockResolvedValue({
        _count: { _all: 3 },
        _sum: { amount: 4500n },
      });
      prisma.settlementBatch.aggregate.mockResolvedValue({
        _count: { _all: 2 },
        _sum: { totalAmount: 7000n },
      });
      prisma.accountBalance.findMany.mockResolvedValue([
        { ...accountBalanceRow('4000', 'Service Fee Revenue', 8000n), account: { code: '4000', name: 'Service Fee Revenue', accountType: 'REVENUE' } },
        { ...accountBalanceRow('5000', 'Delivery Expense', 2000n), account: { code: '5000', name: 'Delivery Expense', accountType: 'EXPENSE' } },
      ]);

      const result = await service.financeOverview();

      expect(prisma.escrowHold.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: EscrowStatus.HELD } }),
      );
      const merchantRow = result.wallets.find(
        (w) => w.ownerType === WalletOwnerType.MERCHANT,
      );
      expect(merchantRow).toMatchObject({
        walletCount: 5,
        availableTotal: '10000',
        heldTotal: '1000',
        total: '11000',
      });
      expect(result.escrow).toEqual({ heldCount: 3, heldAmount: '4500' });
      expect(result.settlements).toEqual({
        pendingBatchCount: 2,
        pendingAmount: '7000',
      });
      expect(result.latestPeriod).toMatchObject({
        id: PERIOD_ID,
        netIncome: '6000',
      });
    });

    it('reports latestPeriod as null when there is no open period', async () => {
      prisma.accountingPeriod.findFirst.mockResolvedValue(null);

      const result = await service.financeOverview();
      expect(result.latestPeriod).toBeNull();
    });
  });

  describe('p-and-l export routing', () => {
    it('exports the p-and-l alias using the same rows as income-statement', async () => {
      prisma.accountBalance.findMany.mockResolvedValue([
        {
          ...accountBalanceRow('4000', 'Service Fee Revenue', 1000n),
          account: { code: '4000', name: 'Service Fee Revenue', accountType: 'REVENUE' },
        },
      ]);

      const result = await service.exportReport('p-and-l', 'csv', {});
      expect(result.filename).toBe('p-and-l.csv');
      expect(result.buffer.length).toBeGreaterThan(0);
    });
  });
});
