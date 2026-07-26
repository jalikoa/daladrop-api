import {
  InvalidJournalLineError,
  JournalDraft,
  UnbalancedJournalError,
} from '../domain/journal';

describe('JournalDraft', () => {
  it('adds debit and credit and reports balance', () => {
    const draft = new JournalDraft('KES', 'test')
      .addDebit('1000', 500n, 'cash')
      .addCredit('1200', 500n, 'escrow');

    expect(draft.isBalanced()).toBe(true);
    expect(draft.totalDebit).toBe(500n);
    expect(draft.totalCredit).toBe(500n);
    draft.assertBalanced();

    const pub = draft.toPublic();
    expect(pub.balanced).toBe(true);
    expect(pub.totalDebit).toBe('500');
    expect(pub.lines).toHaveLength(2);
    expect(pub.lines[0]).toMatchObject({
      accountCode: '1000',
      debitAmount: '500',
      creditAmount: '0',
    });
  });

  it('throws when unbalanced', () => {
    const draft = new JournalDraft().addDebit('1000', 100n).addCredit('1200', 90n);
    expect(() => draft.assertBalanced()).toThrow(UnbalancedJournalError);
  });

  it('rejects zero or negative amounts', () => {
    const draft = new JournalDraft();
    expect(() => draft.addDebit('1000', 0n)).toThrow(InvalidJournalLineError);
    expect(() => draft.addCredit('1200', -1n)).toThrow(InvalidJournalLineError);
  });

  it('rejects empty journals', () => {
    expect(() => new JournalDraft().assertBalanced()).toThrow(
      InvalidJournalLineError,
    );
  });
});
