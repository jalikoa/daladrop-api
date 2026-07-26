import { WalletTransactionType } from '@prisma/client';
import { Money } from '../../../shared/money';
import { kesZero } from '../../../shared/money';
import type { WalletBalanceSnapshot } from './wallet-balance';

export class InsufficientAvailableError extends Error {
  public constructor(message = 'Insufficient available balance') {
    super(message);
    this.name = 'InsufficientAvailableError';
  }
}

export class InsufficientHeldError extends Error {
  public constructor(message = 'Insufficient held balance') {
    super(message);
    this.name = 'InsufficientHeldError';
  }
}

export class InvalidWalletAmountError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidWalletAmountError';
  }
}

/** Shape of an append-only wallet_transactions row (Money at domain boundary). */
export interface WalletTxnShape {
  readonly type: WalletTransactionType;
  readonly debitAmount: Money;
  readonly creditAmount: Money;
  readonly balanceAfter: Money;
  readonly holdAfter: Money;
}

export interface WalletOpResult {
  readonly next: WalletBalanceSnapshot;
  readonly txn: WalletTxnShape;
}

function assertPositive(money: Money, label = 'amount'): void {
  if (!money.isPositive()) {
    throw new InvalidWalletAmountError(`${label} must be a positive KES amount`);
  }
}

function bump(
  snapshot: WalletBalanceSnapshot,
  available: Money,
  held: Money,
): WalletBalanceSnapshot {
  return {
    available,
    held,
    version: snapshot.version + 1,
  };
}

/** CREDIT — increases available (spendable) balance. */
export function applyCredit(
  snapshot: WalletBalanceSnapshot,
  money: Money,
): WalletOpResult {
  assertPositive(money);
  const available = snapshot.available.add(money);
  const held = snapshot.held;
  return {
    next: bump(snapshot, available, held),
    txn: {
      type: WalletTransactionType.CREDIT,
      debitAmount: kesZero(),
      creditAmount: money,
      balanceAfter: available,
      holdAfter: held,
    },
  };
}

/** DEBIT — decreases available; requires available >= money. */
export function applyDebit(
  snapshot: WalletBalanceSnapshot,
  money: Money,
): WalletOpResult {
  assertPositive(money);
  if (snapshot.available.compareTo(money) < 0) {
    throw new InsufficientAvailableError();
  }
  const available = snapshot.available.subtract(money);
  const held = snapshot.held;
  return {
    next: bump(snapshot, available, held),
    txn: {
      type: WalletTransactionType.DEBIT,
      debitAmount: money,
      creditAmount: kesZero(),
      balanceAfter: available,
      holdAfter: held,
    },
  };
}

/**
 * HOLD — moves available → held, or credits incoming escrow into held only
 * when `fromExternal` is true (payment collection mirror).
 */
export function applyHold(
  snapshot: WalletBalanceSnapshot,
  money: Money,
  options: { readonly fromExternal?: boolean } = {},
): WalletOpResult {
  assertPositive(money);
  if (options.fromExternal) {
    const available = snapshot.available;
    const held = snapshot.held.add(money);
    return {
      next: bump(snapshot, available, held),
      txn: {
        type: WalletTransactionType.HOLD,
        debitAmount: kesZero(),
        creditAmount: money,
        balanceAfter: available,
        holdAfter: held,
      },
    };
  }
  if (snapshot.available.compareTo(money) < 0) {
    throw new InsufficientAvailableError('Insufficient available to hold');
  }
  const available = snapshot.available.subtract(money);
  const held = snapshot.held.add(money);
  return {
    next: bump(snapshot, available, held),
    txn: {
      type: WalletTransactionType.HOLD,
      debitAmount: money,
      creditAmount: kesZero(),
      balanceAfter: available,
      holdAfter: held,
    },
  };
}

/** RELEASE — held → available. */
export function applyRelease(
  snapshot: WalletBalanceSnapshot,
  money: Money,
): WalletOpResult {
  assertPositive(money);
  if (snapshot.held.compareTo(money) < 0) {
    throw new InsufficientHeldError();
  }
  const held = snapshot.held.subtract(money);
  const available = snapshot.available.add(money);
  return {
    next: bump(snapshot, available, held),
    txn: {
      type: WalletTransactionType.RELEASE,
      debitAmount: kesZero(),
      creditAmount: money,
      balanceAfter: available,
      holdAfter: held,
    },
  };
}

/**
 * Reverse an external hold (forfeit / refund): decrease held without
 * increasing available — liability leaves the wallet.
 */
export function applyUnhold(
  snapshot: WalletBalanceSnapshot,
  money: Money,
): WalletOpResult {
  assertPositive(money);
  if (snapshot.held.compareTo(money) < 0) {
    throw new InsufficientHeldError();
  }
  const held = snapshot.held.subtract(money);
  const available = snapshot.available;
  return {
    next: bump(snapshot, available, held),
    txn: {
      type: WalletTransactionType.DEBIT,
      debitAmount: money,
      creditAmount: kesZero(),
      balanceAfter: available,
      holdAfter: held,
    },
  };
}

/**
 * ADJUSTMENT — signed Money: positive credits available, negative debits.
 * Admin only at the use-case boundary.
 */
export function applyAdjust(
  snapshot: WalletBalanceSnapshot,
  money: Money,
): WalletOpResult {
  if (money.isZero()) {
    throw new InvalidWalletAmountError('Adjustment amount must be non-zero');
  }
  if (money.isPositive()) {
    const available = snapshot.available.add(money);
    const held = snapshot.held;
    return {
      next: bump(snapshot, available, held),
      txn: {
        type: WalletTransactionType.ADJUSTMENT,
        debitAmount: kesZero(),
        creditAmount: money,
        balanceAfter: available,
        holdAfter: held,
      },
    };
  }
  const abs = money.negate();
  if (snapshot.available.compareTo(abs) < 0) {
    throw new InsufficientAvailableError(
      'Insufficient available for negative adjustment',
    );
  }
  const available = snapshot.available.subtract(abs);
  const held = snapshot.held;
  return {
    next: bump(snapshot, available, held),
    txn: {
      type: WalletTransactionType.ADJUSTMENT,
      debitAmount: abs,
      creditAmount: kesZero(),
      balanceAfter: available,
      holdAfter: held,
    },
  };
}
