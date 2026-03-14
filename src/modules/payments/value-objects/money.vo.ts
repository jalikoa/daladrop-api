import { PAYMENT_CONSTANTS } from '../constants/payment.constants';

export class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string = PAYMENT_CONSTANTS.STK.CURRENCY,
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.amount < PAYMENT_CONSTANTS.STK.MIN_AMOUNT) {
      throw new Error(`Amount must be at least ${PAYMENT_CONSTANTS.STK.MIN_AMOUNT}`);
    }

    if (this.amount > PAYMENT_CONSTANTS.STK.MAX_AMOUNT) {
      throw new Error(`Amount cannot exceed ${PAYMENT_CONSTANTS.STK.MAX_AMOUNT}`);
    }

    if (!Number.isInteger(this.amount)) {
      throw new Error('Amount must be an integer (cents/smallest unit)');
    }
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) {
      throw new Error('Currency mismatch');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    if (other.currency !== this.currency) {
      throw new Error('Currency mismatch');
    }
    if (other.amount > this.amount) {
      throw new Error('Insufficient amount');
    }
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(multiplier: number): Money {
    return new Money(Math.round(this.amount * multiplier), this.currency);
  }

  toKES(): number {
    return this.amount / 100;
  }

  toJSON(): Record<string, unknown> {
    return {
      amount: this.amount,
      currency: this.currency,
      kes: this.toKES(),
    };
  }
}
