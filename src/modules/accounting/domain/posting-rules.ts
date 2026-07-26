import { CoaCodes } from '../constants/coa-codes';
import {
  InvalidJournalLineError,
  JournalDraft,
  UnbalancedJournalError,
} from './journal';

export interface PaymentAllocationHint {
  readonly amount: bigint;
  readonly accountCodeHint?: string | null;
  readonly label?: string | null;
}

export interface ResolvePaymentPostingInput {
  readonly purpose: string;
  readonly amount: bigint;
  readonly currency?: string;
  readonly description?: string;
  readonly allocations?: readonly PaymentAllocationHint[];
}

/** Maps payment purpose → default credit CoA (debit is always Platform Cash). */
export function defaultCreditAccountForPurpose(purpose: string): string {
  switch (purpose) {
    case 'ORDER':
      return CoaCodes.ESCROW_COMMERCE;
    case 'RIDE':
      return CoaCodes.ESCROW_RIDES;
    case 'EVENT_BOOKING':
      return CoaCodes.ORGANIZER_PAYABLES;
    case 'WALLET_TOP_UP':
      return CoaCodes.CUSTOMER_WALLETS;
    case 'OTHER':
    default:
      return CoaCodes.REVENUE_HOLDING;
  }
}

/**
 * Resolve double-entry lines for a collected payment.
 *
 * Without allocation hints: Dr 1000 / Cr purpose default.
 * With accountCodeHint allocations: Dr 1000 full amount, credit each hint,
 * remaining unallocated (if any) to purpose default credit. Must balance.
 */
export function resolvePaymentPostingLines(
  input: ResolvePaymentPostingInput,
): JournalDraft {
  if (input.amount <= 0n) {
    throw new InvalidJournalLineError('Payment amount must be greater than zero');
  }

  const draft = new JournalDraft(
    input.currency ?? 'KES',
    input.description ?? `Payment collected (${input.purpose})`,
  );
  const defaultCredit = defaultCreditAccountForPurpose(input.purpose);
  const hinted = (input.allocations ?? []).filter(
    (row) =>
      typeof row.accountCodeHint === 'string' &&
      row.accountCodeHint.trim().length > 0,
  );

  draft.addDebit(
    CoaCodes.PLATFORM_CASH,
    input.amount,
    'Payment clearing',
  );

  if (hinted.length === 0) {
    draft.addCredit(defaultCredit, input.amount, `Purpose ${input.purpose}`);
    draft.assertBalanced();
    return draft;
  }

  let allocated = 0n;
  for (const row of hinted) {
    if (row.amount <= 0n) {
      throw new InvalidJournalLineError(
        `Allocation amount must be greater than zero (${row.label ?? row.accountCodeHint})`,
      );
    }
    allocated += row.amount;
    draft.addCredit(
      row.accountCodeHint!.trim(),
      row.amount,
      row.label ?? undefined,
    );
  }

  if (allocated > input.amount) {
    throw new UnbalancedJournalError(input.amount, allocated);
  }

  const remaining = input.amount - allocated;
  if (remaining > 0n) {
    draft.addCredit(
      defaultCredit,
      remaining,
      `Unallocated ${input.purpose}`,
    );
  }

  draft.assertBalanced();
  return draft;
}

export interface ResolveRefundPostingInput {
  readonly purpose: string;
  readonly amount: bigint;
  readonly currency?: string;
  readonly description?: string;
  readonly allocations?: readonly PaymentAllocationHint[];
}

/**
 * Resolve double-entry lines to unwind a refunded payment.
 *
 * Mirror image of {@link resolvePaymentPostingLines}: Dr the purpose default
 * (and any allocation hints, proportional to the refund amount) / Cr Platform
 * Cash. This releases escrow/payable/wallet liability back out of the books
 * as cash leaves the platform.
 */
export function resolveRefundPostingLines(
  input: ResolveRefundPostingInput,
): JournalDraft {
  if (input.amount <= 0n) {
    throw new InvalidJournalLineError('Refund amount must be greater than zero');
  }

  const draft = new JournalDraft(
    input.currency ?? 'KES',
    input.description ?? `Refund (${input.purpose})`,
  );
  const defaultDebit = defaultCreditAccountForPurpose(input.purpose);
  const hinted = (input.allocations ?? []).filter(
    (row) =>
      typeof row.accountCodeHint === 'string' &&
      row.accountCodeHint.trim().length > 0,
  );

  if (hinted.length === 0) {
    draft.addDebit(defaultDebit, input.amount, `Purpose ${input.purpose}`);
    draft.addCredit(CoaCodes.PLATFORM_CASH, input.amount, 'Refund clearing');
    draft.assertBalanced();
    return draft;
  }

  let allocated = 0n;
  for (const row of hinted) {
    if (row.amount <= 0n) {
      throw new InvalidJournalLineError(
        `Allocation amount must be greater than zero (${row.label ?? row.accountCodeHint})`,
      );
    }
    allocated += row.amount;
    draft.addDebit(
      row.accountCodeHint!.trim(),
      row.amount,
      row.label ?? undefined,
    );
  }

  if (allocated > input.amount) {
    throw new UnbalancedJournalError(input.amount, allocated);
  }

  const remaining = input.amount - allocated;
  if (remaining > 0n) {
    draft.addDebit(defaultDebit, remaining, `Unallocated ${input.purpose}`);
  }

  draft.addCredit(CoaCodes.PLATFORM_CASH, input.amount, 'Refund clearing');
  draft.assertBalanced();
  return draft;
}

/** Maps a settlement beneficiary → the payable/liability CoA it is debited from. */
export function defaultPayableAccountForBeneficiary(beneficiaryType: string): string {
  switch (beneficiaryType) {
    case 'RIDER':
      return CoaCodes.RIDER_PAYABLES;
    case 'MERCHANT':
      return CoaCodes.MERCHANT_PAYABLES;
    case 'ORGANIZER':
      return CoaCodes.ORGANIZER_PAYABLES;
    case 'CUSTOMER':
      return CoaCodes.CUSTOMER_WALLETS;
    case 'PLATFORM':
    default:
      return CoaCodes.REVENUE_HOLDING;
  }
}

/**
 * Resolve double-entry lines for releasing escrow into beneficiary payables.
 * Dr ESCROW_* / Cr MERCHANT|RIDER|ORGANIZER_PAYABLES — must run before settlement
 * so settlement's Dr PAYABLES / Cr PAYOUT_CLEARING stays ledger-balanced.
 */
export function resolveEscrowReleaseLines(input: {
  readonly beneficiaryType: string;
  readonly purpose?: string | null;
  readonly amount: bigint;
  readonly currency?: string;
  readonly description?: string;
}): JournalDraft {
  if (input.amount <= 0n) {
    throw new InvalidJournalLineError('Escrow release amount must be greater than zero');
  }
  const draft = new JournalDraft(
    input.currency ?? 'KES',
    input.description ?? `Escrow release (${input.beneficiaryType})`,
  );
  const escrowAccount =
    input.purpose === 'RIDE' ? CoaCodes.ESCROW_RIDES : CoaCodes.ESCROW_COMMERCE;
  const payableAccount = defaultPayableAccountForBeneficiary(input.beneficiaryType);
  draft.addDebit(escrowAccount, input.amount, 'Release escrow');
  draft.addCredit(payableAccount, input.amount, `Payable ${input.beneficiaryType}`);
  draft.assertBalanced();
  return draft;
}

export interface ResolveSettlementPayoutInput {
  readonly beneficiaryType: string;
  readonly amount: bigint;
  readonly currency?: string;
  readonly description?: string;
}

/**
 * Resolve double-entry lines for a settlement batch payout.
 * Dr the beneficiary payable/liability account / Cr Payout Clearing (6000),
 * which the payout provider (manual, B2C, bank) later clears externally.
 */
export function resolveSettlementPayoutLines(
  input: ResolveSettlementPayoutInput,
): JournalDraft {
  if (input.amount <= 0n) {
    throw new InvalidJournalLineError('Settlement amount must be greater than zero');
  }

  const draft = new JournalDraft(
    input.currency ?? 'KES',
    input.description ?? `Settlement payout (${input.beneficiaryType})`,
  );
  const debitAccount = defaultPayableAccountForBeneficiary(input.beneficiaryType);
  draft.addDebit(debitAccount, input.amount, `Payout ${input.beneficiaryType}`);
  draft.addCredit(CoaCodes.PAYOUT_CLEARING, input.amount, 'Payout clearing');
  draft.assertBalanced();
  return draft;
}
