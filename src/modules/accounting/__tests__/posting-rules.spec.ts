import { CoaCodes } from '../constants/coa-codes';
import { UnbalancedJournalError } from '../domain/journal';
import {
  defaultCreditAccountForPurpose,
  defaultPayableAccountForBeneficiary,
  resolveEscrowReleaseLines,
  resolvePaymentPostingLines,
  resolveRefundPostingLines,
  resolveSettlementPayoutLines,
} from '../domain/posting-rules';

describe('posting-rules', () => {
  it('maps purposes to default credit accounts', () => {
    expect(defaultCreditAccountForPurpose('ORDER')).toBe(CoaCodes.ESCROW_COMMERCE);
    expect(defaultCreditAccountForPurpose('RIDE')).toBe(CoaCodes.ESCROW_RIDES);
    expect(defaultCreditAccountForPurpose('EVENT_BOOKING')).toBe(
      CoaCodes.ORGANIZER_PAYABLES,
    );
    expect(defaultCreditAccountForPurpose('WALLET_TOP_UP')).toBe(
      CoaCodes.CUSTOMER_WALLETS,
    );
    expect(defaultCreditAccountForPurpose('OTHER')).toBe(CoaCodes.REVENUE_HOLDING);
    expect(defaultCreditAccountForPurpose('SETTLEMENT')).toBe(
      CoaCodes.REVENUE_HOLDING,
    );
  });

  it('posts Dr 1000 / Cr purpose default without allocations', () => {
    const draft = resolvePaymentPostingLines({
      purpose: 'ORDER',
      amount: 1200n,
    });
    const lines = draft.getLines();
    expect(lines).toEqual([
      {
        accountCode: CoaCodes.PLATFORM_CASH,
        debitAmount: 1200n,
        creditAmount: 0n,
        memo: 'Payment clearing',
      },
      {
        accountCode: CoaCodes.ESCROW_COMMERCE,
        debitAmount: 0n,
        creditAmount: 1200n,
        memo: 'Purpose ORDER',
      },
    ]);
  });

  it('splits credits across allocation hints and remaining default', () => {
    const draft = resolvePaymentPostingLines({
      purpose: 'ORDER',
      amount: 1000n,
      allocations: [
        { amount: 700n, accountCodeHint: CoaCodes.ESCROW_COMMERCE, label: 'goods' },
        { amount: 200n, accountCodeHint: CoaCodes.SERVICE_FEE_REVENUE, label: 'fee' },
      ],
    });
    const credits = draft
      .getLines()
      .filter((l) => l.creditAmount > 0n)
      .map((l) => ({ code: l.accountCode, amount: l.creditAmount }));
    expect(credits).toEqual([
      { code: CoaCodes.ESCROW_COMMERCE, amount: 700n },
      { code: CoaCodes.SERVICE_FEE_REVENUE, amount: 200n },
      { code: CoaCodes.ESCROW_COMMERCE, amount: 100n },
    ]);
    draft.assertBalanced();
  });

  it('throws when allocations exceed payment amount', () => {
    expect(() =>
      resolvePaymentPostingLines({
        purpose: 'ORDER',
        amount: 100n,
        allocations: [
          { amount: 80n, accountCodeHint: '1200' },
          { amount: 50n, accountCodeHint: '4000' },
        ],
      }),
    ).toThrow(UnbalancedJournalError);
  });

  it('ignores allocations without accountCodeHint', () => {
    const draft = resolvePaymentPostingLines({
      purpose: 'RIDE',
      amount: 500n,
      allocations: [{ amount: 500n, accountCodeHint: null, label: 'ignored' }],
    });
    expect(draft.getLines()[1]?.accountCode).toBe(CoaCodes.ESCROW_RIDES);
  });
});

describe('resolveRefundPostingLines', () => {
  it('posts Dr purpose default / Cr 1000 without allocations', () => {
    const draft = resolveRefundPostingLines({ purpose: 'ORDER', amount: 1200n });
    expect(draft.getLines()).toEqual([
      {
        accountCode: CoaCodes.ESCROW_COMMERCE,
        debitAmount: 1200n,
        creditAmount: 0n,
        memo: 'Purpose ORDER',
      },
      {
        accountCode: CoaCodes.PLATFORM_CASH,
        debitAmount: 0n,
        creditAmount: 1200n,
        memo: 'Refund clearing',
      },
    ]);
    draft.assertBalanced();
  });

  it('splits debits across allocation hints and remaining default (mirror of collection)', () => {
    const draft = resolveRefundPostingLines({
      purpose: 'ORDER',
      amount: 1000n,
      allocations: [
        { amount: 700n, accountCodeHint: CoaCodes.ESCROW_COMMERCE, label: 'goods' },
        { amount: 200n, accountCodeHint: CoaCodes.SERVICE_FEE_REVENUE, label: 'fee' },
      ],
    });
    const debits = draft
      .getLines()
      .filter((l) => l.debitAmount > 0n)
      .map((l) => ({ code: l.accountCode, amount: l.debitAmount }));
    expect(debits).toEqual([
      { code: CoaCodes.ESCROW_COMMERCE, amount: 700n },
      { code: CoaCodes.SERVICE_FEE_REVENUE, amount: 200n },
      { code: CoaCodes.ESCROW_COMMERCE, amount: 100n },
    ]);
    const credit = draft.getLines().find((l) => l.creditAmount > 0n);
    expect(credit).toEqual({
      accountCode: CoaCodes.PLATFORM_CASH,
      debitAmount: 0n,
      creditAmount: 1000n,
      memo: 'Refund clearing',
    });
    draft.assertBalanced();
  });

  it('throws when allocations exceed refund amount', () => {
    expect(() =>
      resolveRefundPostingLines({
        purpose: 'ORDER',
        amount: 100n,
        allocations: [
          { amount: 80n, accountCodeHint: '1200' },
          { amount: 50n, accountCodeHint: '4000' },
        ],
      }),
    ).toThrow(UnbalancedJournalError);
  });

  it('rejects a zero or negative refund amount', () => {
    expect(() => resolveRefundPostingLines({ purpose: 'ORDER', amount: 0n })).toThrow(
      'Refund amount must be greater than zero',
    );
  });
});

describe('resolveSettlementPayoutLines', () => {
  it('maps beneficiary types to payable accounts', () => {
    expect(defaultPayableAccountForBeneficiary('RIDER')).toBe(CoaCodes.RIDER_PAYABLES);
    expect(defaultPayableAccountForBeneficiary('MERCHANT')).toBe(CoaCodes.MERCHANT_PAYABLES);
    expect(defaultPayableAccountForBeneficiary('ORGANIZER')).toBe(CoaCodes.ORGANIZER_PAYABLES);
    expect(defaultPayableAccountForBeneficiary('CUSTOMER')).toBe(CoaCodes.CUSTOMER_WALLETS);
    expect(defaultPayableAccountForBeneficiary('PLATFORM')).toBe(CoaCodes.REVENUE_HOLDING);
  });

  it('posts Dr rider payables / Cr payout clearing for RIDER payouts', () => {
    const draft = resolveSettlementPayoutLines({ beneficiaryType: 'RIDER', amount: 5000n });
    expect(draft.getLines()).toEqual([
      {
        accountCode: CoaCodes.RIDER_PAYABLES,
        debitAmount: 5000n,
        creditAmount: 0n,
        memo: 'Payout RIDER',
      },
      {
        accountCode: CoaCodes.PAYOUT_CLEARING,
        debitAmount: 0n,
        creditAmount: 5000n,
        memo: 'Payout clearing',
      },
    ]);
    draft.assertBalanced();
  });

  it('posts Dr merchant payables for MERCHANT payouts', () => {
    const draft = resolveSettlementPayoutLines({ beneficiaryType: 'MERCHANT', amount: 800n });
    expect(draft.getLines()[0]?.accountCode).toBe(CoaCodes.MERCHANT_PAYABLES);
  });

  it('posts Dr organizer payables for ORGANIZER payouts', () => {
    const draft = resolveSettlementPayoutLines({ beneficiaryType: 'ORGANIZER', amount: 300n });
    expect(draft.getLines()[0]?.accountCode).toBe(CoaCodes.ORGANIZER_PAYABLES);
  });

  it('rejects a zero or negative settlement amount', () => {
    expect(() =>
      resolveSettlementPayoutLines({ beneficiaryType: 'RIDER', amount: 0n }),
    ).toThrow('Settlement amount must be greater than zero');
  });
});

describe('resolveEscrowReleaseLines', () => {
  it('posts Dr escrow / Cr merchant payables for ORDER release', () => {
    const draft = resolveEscrowReleaseLines({
      beneficiaryType: 'MERCHANT',
      purpose: 'ORDER',
      amount: 500n,
    });
    expect(draft.getLines()).toEqual([
      {
        accountCode: CoaCodes.ESCROW_COMMERCE,
        debitAmount: 500n,
        creditAmount: 0n,
        memo: 'Release escrow',
      },
      {
        accountCode: CoaCodes.MERCHANT_PAYABLES,
        debitAmount: 0n,
        creditAmount: 500n,
        memo: 'Payable MERCHANT',
      },
    ]);
    draft.assertBalanced();
  });

  it('uses ride escrow for RIDE purpose', () => {
    const draft = resolveEscrowReleaseLines({
      beneficiaryType: 'RIDER',
      purpose: 'RIDE',
      amount: 200n,
    });
    expect(draft.getLines()[0]?.accountCode).toBe(CoaCodes.ESCROW_RIDES);
    expect(draft.getLines()[1]?.accountCode).toBe(CoaCodes.RIDER_PAYABLES);
  });
});
