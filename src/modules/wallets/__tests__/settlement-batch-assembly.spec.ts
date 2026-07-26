import {
  selectEligibleWallets,
  sumSettlementAmount,
} from '../domain/settlement-batch-assembly';

describe('selectEligibleWallets', () => {
  it('selects wallets at/above the minimum, settling the full available balance', () => {
    const selections = selectEligibleWallets(
      [
        { id: 'w1', balanceAmount: 5000n, currency: 'KES' },
        { id: 'w2', balanceAmount: 100n, currency: 'KES' },
        { id: 'w3', balanceAmount: 500n, currency: 'KES' },
      ],
      500n,
    );
    expect(selections).toEqual([
      { walletId: 'w1', amount: 5000n },
      { walletId: 'w3', amount: 500n },
    ]);
  });

  it('excludes zero and negative balances regardless of minimum', () => {
    const selections = selectEligibleWallets(
      [
        { id: 'w1', balanceAmount: 0n, currency: 'KES' },
        { id: 'w2', balanceAmount: -10n, currency: 'KES' },
      ],
      0n,
    );
    expect(selections).toEqual([]);
  });

  it('returns an empty array when no wallets are eligible', () => {
    expect(
      selectEligibleWallets([{ id: 'w1', balanceAmount: 10n, currency: 'KES' }], 1000n),
    ).toEqual([]);
  });

  it('rejects a negative minimumAmount', () => {
    expect(() => selectEligibleWallets([], -1n)).toThrow(
      'minimumAmount must not be negative',
    );
  });
});

describe('sumSettlementAmount', () => {
  it('sums selection amounts as a KES bigint', () => {
    const total = sumSettlementAmount([
      { walletId: 'w1', amount: 5000n },
      { walletId: 'w2', amount: 250n },
    ]);
    expect(total).toBe(5250n);
  });

  it('returns zero for an empty selection set', () => {
    expect(sumSettlementAmount([])).toBe(0n);
  });
});
