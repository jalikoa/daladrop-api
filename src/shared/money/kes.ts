import { Money } from './money';

/** ISO 4217 code for Kenyan Shilling. */
export const KES_CURRENCY = 'KES';

/**
 * KES amounts are whole shillings — zero fractional (minor-unit) digits.
 * Prefer these helpers over `Money.of(..., 'KES')` which defaults to scale 2.
 */
export const KES_MINOR_UNIT_DIGITS = 0;

/** Creates a KES Money value from whole shillings. */
export function kes(amountShillings: number): Money {
  return Money.of(amountShillings, KES_CURRENCY, KES_MINOR_UNIT_DIGITS);
}

/** Zero KES. */
export function kesZero(): Money {
  return Money.zero(KES_CURRENCY, KES_MINOR_UNIT_DIGITS);
}

/**
 * Parses a decimal string of whole shillings into KES Money.
 * Rejects fractional shillings (e.g. `"10.5"`).
 */
export function kesFromDecimalString(value: string): Money {
  return Money.fromDecimalString(value, KES_CURRENCY, KES_MINOR_UNIT_DIGITS);
}

export function isKesMoney(money: Money): boolean {
  return money.currency === KES_CURRENCY;
}

/**
 * Converts a persisted BigInt KES amount (whole shillings) into {@link Money}.
 * All wallet / ledger arithmetic should go through Money — never raw BigInt math
 * in domain services except at the persistence boundary.
 */
export function kesFromBigInt(amount: bigint): Money {
  if (
    amount > BigInt(Number.MAX_SAFE_INTEGER) ||
    amount < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new RangeError('KES amount exceeds JavaScript safe integer range');
  }
  return kes(Number(amount));
}

/** Persists a KES {@link Money} value as BigInt whole shillings. */
export function kesToBigInt(money: Money): bigint {
  if (!isKesMoney(money)) {
    throw new TypeError(
      `Expected KES Money, received ${money.currency}`,
    );
  }
  return BigInt(money.amount);
}
