import {
  emptyWalletBalance,
  walletBalanceFromAmounts,
} from '../domain/wallet-balance';

describe('wallet-balance', () => {
  it('derives available, held, pending, and total via Money.add', () => {
    const view = walletBalanceFromAmounts(1200n, 300n);
    expect(view.available.amount).toBe(1200);
    expect(view.held.amount).toBe(300);
    expect(view.pending.amount).toBe(300);
    expect(view.total.amount).toBe(1500);
  });

  it('returns zero balances', () => {
    const empty = emptyWalletBalance();
    expect(empty.total.isZero()).toBe(true);
  });
});
