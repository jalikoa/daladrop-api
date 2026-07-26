export interface JournalLineDraft {
  readonly accountCode: string;
  readonly debitAmount: bigint;
  readonly creditAmount: bigint;
  readonly memo?: string;
}

export interface JournalDraftPublic {
  readonly currency: string;
  readonly description?: string;
  readonly totalDebit: string;
  readonly totalCredit: string;
  readonly balanced: boolean;
  readonly lines: ReadonlyArray<{
    readonly accountCode: string;
    readonly debitAmount: string;
    readonly creditAmount: string;
    readonly memo?: string;
  }>;
}

export class UnbalancedJournalError extends Error {
  public constructor(debit: bigint, credit: bigint) {
    super(
      `Journal is unbalanced: debit ${debit.toString()} != credit ${credit.toString()}`,
    );
    this.name = 'UnbalancedJournalError';
  }
}

export class InvalidJournalLineError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidJournalLineError';
  }
}

/**
 * Mutable draft for double-entry journal lines (KES whole shillings).
 * Debit must equal credit before posting.
 */
export class JournalDraft {
  private readonly lines: JournalLineDraft[] = [];

  public constructor(
    public readonly currency: string = 'KES',
    public readonly description?: string,
  ) {}

  public addDebit(
    accountCode: string,
    amount: bigint,
    memo?: string,
  ): this {
    this.assertAmount(amount);
    this.assertAccountCode(accountCode);
    this.lines.push({
      accountCode,
      debitAmount: amount,
      creditAmount: 0n,
      memo,
    });
    return this;
  }

  public addCredit(
    accountCode: string,
    amount: bigint,
    memo?: string,
  ): this {
    this.assertAmount(amount);
    this.assertAccountCode(accountCode);
    this.lines.push({
      accountCode,
      debitAmount: 0n,
      creditAmount: amount,
      memo,
    });
    return this;
  }

  public getLines(): readonly JournalLineDraft[] {
    return this.lines;
  }

  public get totalDebit(): bigint {
    return this.lines.reduce((sum, line) => sum + line.debitAmount, 0n);
  }

  public get totalCredit(): bigint {
    return this.lines.reduce((sum, line) => sum + line.creditAmount, 0n);
  }

  public isBalanced(): boolean {
    return this.lines.length > 0 && this.totalDebit === this.totalCredit;
  }

  public assertBalanced(): void {
    if (this.lines.length === 0) {
      throw new InvalidJournalLineError('Journal must have at least one line');
    }
    if (this.totalDebit !== this.totalCredit) {
      throw new UnbalancedJournalError(this.totalDebit, this.totalCredit);
    }
    for (const line of this.lines) {
      const hasDebit = line.debitAmount > 0n;
      const hasCredit = line.creditAmount > 0n;
      if (hasDebit === hasCredit) {
        throw new InvalidJournalLineError(
          `Line for ${line.accountCode} must have XOR debit/credit (exactly one side > 0)`,
        );
      }
    }
  }

  public toPublic(): JournalDraftPublic {
    return {
      currency: this.currency,
      description: this.description,
      totalDebit: this.totalDebit.toString(),
      totalCredit: this.totalCredit.toString(),
      balanced: this.isBalanced(),
      lines: this.lines.map((line) => ({
        accountCode: line.accountCode,
        debitAmount: line.debitAmount.toString(),
        creditAmount: line.creditAmount.toString(),
        memo: line.memo,
      })),
    };
  }

  private assertAmount(amount: bigint): void {
    if (amount <= 0n) {
      throw new InvalidJournalLineError('Amount must be greater than zero');
    }
  }

  private assertAccountCode(accountCode: string): void {
    if (!accountCode.trim()) {
      throw new InvalidJournalLineError('Account code is required');
    }
  }
}
