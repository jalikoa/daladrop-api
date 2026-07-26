import { Money } from '../../../shared/money';
import { kesFromBigInt, kesZero } from '../../../shared/money';

/** In-memory wallet balance view (Money domain; never raw bigint math). */
export interface WalletBalanceView {
  readonly available: Money;
  readonly held: Money;
  readonly pending: Money;
  readonly total: Money;
}

export interface WalletBalanceSnapshot {
  readonly available: Money;
  readonly held: Money;
  readonly version: number;
}

export function walletBalanceFromAmounts(
  balanceAmount: bigint,
  holdAmount: bigint,
): WalletBalanceView {
  const available = kesFromBigInt(balanceAmount);
  const held = kesFromBigInt(holdAmount);
  return {
    available,
    held,
    pending: held,
    total: available.add(held),
  };
}

export function emptyWalletBalance(): WalletBalanceView {
  const zero = kesZero();
  return {
    available: zero,
    held: zero,
    pending: zero,
    total: zero,
  };
}

export function snapshotFromBigInt(
  balanceAmount: bigint,
  holdAmount: bigint,
  version: number,
): WalletBalanceSnapshot {
  return {
    available: kesFromBigInt(balanceAmount),
    held: kesFromBigInt(holdAmount),
    version,
  };
}
