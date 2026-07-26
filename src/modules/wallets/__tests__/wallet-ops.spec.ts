import { WalletTransactionType } from '@prisma/client';
import { kes, kesZero } from '../../../shared/money';
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
} from '../domain/wallet-ops';
import type { WalletBalanceSnapshot } from '../domain/wallet-balance';

function snap(
  available: number,
  held: number,
  version = 0,
): WalletBalanceSnapshot {
  return {
    available: kes(available),
    held: kes(held),
    version,
  };
}

describe('wallet-ops', () => {
  it('credits available balance', () => {
    const result = applyCredit(snap(100, 50), kes(25));
    expect(result.next.available.amount).toBe(125);
    expect(result.next.held.amount).toBe(50);
    expect(result.next.version).toBe(1);
    expect(result.txn.type).toBe(WalletTransactionType.CREDIT);
    expect(result.txn.creditAmount.amount).toBe(25);
    expect(result.txn.debitAmount.isZero()).toBe(true);
    expect(result.txn.balanceAfter.amount).toBe(125);
  });

  it('debits available and rejects overdraft', () => {
    const result = applyDebit(snap(100, 0), kes(40));
    expect(result.next.available.amount).toBe(60);
    expect(result.txn.type).toBe(WalletTransactionType.DEBIT);
    expect(result.txn.debitAmount.amount).toBe(40);

    expect(() => applyDebit(snap(10, 0), kes(11))).toThrow(
      InsufficientAvailableError,
    );
  });

  it('holds from available into held', () => {
    const result = applyHold(snap(200, 10), kes(50));
    expect(result.next.available.amount).toBe(150);
    expect(result.next.held.amount).toBe(60);
    expect(result.txn.type).toBe(WalletTransactionType.HOLD);
    expect(result.txn.debitAmount.amount).toBe(50);
  });

  it('holds from external without reducing available (payment mirror)', () => {
    const result = applyHold(snap(0, 0), kes(500), { fromExternal: true });
    expect(result.next.available.amount).toBe(0);
    expect(result.next.held.amount).toBe(500);
    expect(result.txn.type).toBe(WalletTransactionType.HOLD);
    expect(result.txn.creditAmount.amount).toBe(500);
    expect(result.txn.debitAmount.isZero()).toBe(true);
  });

  it('releases held into available', () => {
    const result = applyRelease(snap(100, 80), kes(30));
    expect(result.next.available.amount).toBe(130);
    expect(result.next.held.amount).toBe(50);
    expect(result.txn.type).toBe(WalletTransactionType.RELEASE);
    expect(result.txn.creditAmount.amount).toBe(30);

    expect(() => applyRelease(snap(0, 10), kes(11))).toThrow(
      InsufficientHeldError,
    );
  });

  it('unholds (forfeit) by decreasing held only', () => {
    const result = applyUnhold(snap(100, 75), kes(75));
    expect(result.next.available.amount).toBe(100);
    expect(result.next.held.amount).toBe(0);
    expect(result.txn.type).toBe(WalletTransactionType.DEBIT);
    expect(result.txn.debitAmount.amount).toBe(75);
  });

  it('adjusts with signed amounts', () => {
    const credit = applyAdjust(snap(10, 0), kes(5));
    expect(credit.next.available.amount).toBe(15);
    expect(credit.txn.type).toBe(WalletTransactionType.ADJUSTMENT);
    expect(credit.txn.creditAmount.amount).toBe(5);

    const debit = applyAdjust(snap(10, 0), kes(4).negate());
    expect(debit.next.available.amount).toBe(6);
    expect(debit.txn.debitAmount.amount).toBe(4);

    expect(() => applyAdjust(snap(1, 0), kesZero())).toThrow(
      InvalidWalletAmountError,
    );
    expect(() => applyAdjust(snap(1, 0), kes(5).negate())).toThrow(
      InsufficientAvailableError,
    );
  });

  it('rejects non-positive mutation amounts', () => {
    expect(() => applyCredit(snap(0, 0), kesZero())).toThrow(
      InvalidWalletAmountError,
    );
    expect(() => applyHold(snap(0, 0), kes(0))).toThrow(
      InvalidWalletAmountError,
    );
  });
});
