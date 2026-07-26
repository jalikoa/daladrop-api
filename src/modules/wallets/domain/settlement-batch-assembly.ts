import { kesFromBigInt, kesToBigInt, kesZero } from '../../../shared/money';

export interface EligibleWalletInput {
  readonly id: string;
  readonly balanceAmount: bigint;
  readonly currency: string;
}

export interface EligibleWalletSelection {
  readonly walletId: string;
  readonly amount: bigint;
}

/**
 * Selects wallets eligible for settlement: available balance must be
 * strictly positive and at/above `minimumAmount`. Settles the full
 * available balance for each eligible wallet (no partial holdback).
 */
export function selectEligibleWallets(
  wallets: readonly EligibleWalletInput[],
  minimumAmount: bigint,
): EligibleWalletSelection[] {
  if (minimumAmount < 0n) {
    throw new Error('minimumAmount must not be negative');
  }
  const minimum = kesFromBigInt(minimumAmount);
  const selections: EligibleWalletSelection[] = [];
  for (const wallet of wallets) {
    const available = kesFromBigInt(wallet.balanceAmount);
    if (!available.isPositive()) continue;
    if (available.compareTo(minimum) < 0) continue;
    selections.push({ walletId: wallet.id, amount: kesToBigInt(available) });
  }
  return selections;
}

/** Sums a set of settlement selections as a KES bigint total. */
export function sumSettlementAmount(
  selections: readonly EligibleWalletSelection[],
): bigint {
  let total = kesZero();
  for (const selection of selections) {
    total = total.add(kesFromBigInt(selection.amount));
  }
  return kesToBigInt(total);
}
