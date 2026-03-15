import { PAYMENT_CONSTANTS } from '../constants/payment.constants';
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';

export class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string = PAYMENT_CONSTANTS.STK.CURRENCY,
  ) {
    this.validate();
  }

   private validate(): void {
    if (!Number.isInteger(this.amount)) {
      throw new BadRequestException(
        `Amount ${this.amount} must be a whole integer (smallest currency unit, e.g. KES cents)`,
      );
    }
 
    if (this.amount < PAYMENT_CONSTANTS.STK.MIN_AMOUNT) {
      throw new BadRequestException(
        `Amount ${this.amount} is below the minimum of ${PAYMENT_CONSTANTS.STK.MIN_AMOUNT}`,
      );
    }
 
    if (this.amount > PAYMENT_CONSTANTS.STK.MAX_AMOUNT) {
      throw new BadRequestException(
        `Amount ${this.amount} exceeds the maximum of ${PAYMENT_CONSTANTS.STK.MAX_AMOUNT}`,
      );
    }
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) {
      throw new UnprocessableEntityException(
        `Currency mismatch: cannot add ${other.currency} to ${this.currency}`,
      );
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    if (other.currency !== this.currency) {
      throw new UnprocessableEntityException(
        `Currency mismatch: cannot subtract ${other.currency} from ${this.currency}`,
      );
    }
    if (other.amount > this.amount) {
      throw new UnprocessableEntityException(
        `Insufficient amount: cannot subtract ${other.amount} from ${this.amount} ${this.currency}`,
      );
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
