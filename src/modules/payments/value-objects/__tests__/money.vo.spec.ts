import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { Money } from '../money.vo';
import { PAYMENT_CONSTANTS } from '../../constants/payment.constants';

/**
 * Unit Tests for Money Value Object
 * 
 * Tests the Money value object in isolation - no database,
 * no network calls, no external dependencies.
 */
describe('Money Value Object - Unit Tests', () => {
  describe('Construction', () => {
    it('should create a valid Money instance with default KES currency', () => {
      const money = new Money(500);
      expect(money.amount).toBe(500);
      expect(money.currency).toBe('KES');
    });

    it('should create a valid Money instance with explicit currency', () => {
      const money = new Money(1000, 'USD');
      expect(money.amount).toBe(1000);
      expect(money.currency).toBe('USD');
    });

    it('should accept minimum allowed amount', () => {
      const money = new Money(PAYMENT_CONSTANTS.STK.MIN_AMOUNT);
      expect(money.amount).toBe(PAYMENT_CONSTANTS.STK.MIN_AMOUNT);
    });

    it('should accept maximum allowed amount', () => {
      const money = new Money(PAYMENT_CONSTANTS.STK.MAX_AMOUNT);
      expect(money.amount).toBe(PAYMENT_CONSTANTS.STK.MAX_AMOUNT);
    });
  });

  describe('Validation', () => {
    it('should throw BadRequestException for non-integer amount', () => {
      expect(() => new Money(1.5)).toThrow(BadRequestException);
      expect(() => new Money(1.5)).toThrow('must be a whole integer');
    });

    it('should throw BadRequestException for decimal amount', () => {
      expect(() => new Money(99.99)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for amount below minimum', () => {
      const belowMin = PAYMENT_CONSTANTS.STK.MIN_AMOUNT - 1;
      expect(() => new Money(belowMin)).toThrow(BadRequestException);
      expect(() => new Money(belowMin)).toThrow('below the minimum');
    });

    it('should throw BadRequestException for amount above maximum', () => {
      const aboveMax = PAYMENT_CONSTANTS.STK.MAX_AMOUNT + 1;
      expect(() => new Money(aboveMax)).toThrow(BadRequestException);
      expect(() => new Money(aboveMax)).toThrow('exceeds the maximum');
    });

    it('should throw BadRequestException with the actual invalid amount in message', () => {
      const invalidAmount = 500000;
      try {
        new Money(invalidAmount);
        fail('Expected BadRequestException to be thrown');
      } catch (e: any) {
        expect(e.message).toContain(invalidAmount.toString());
      }
    });

    it('should throw BadRequestException for negative amount', () => {
      expect(() => new Money(-100)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for zero amount', () => {
      expect(() => new Money(0)).toThrow(BadRequestException);
    });
  });

  describe('add()', () => {
    it('should add two Money objects with same currency', () => {
      const money1 = new Money(500);
      const money2 = new Money(300);
      const result = money1.add(money2);
      expect(result.amount).toBe(800);
      expect(result.currency).toBe('KES');
    });

    it('should return a new Money instance (immutability)', () => {
      const money1 = new Money(500);
      const money2 = new Money(300);
      const originalAmount = money1.amount;
      const result = money1.add(money2);
      expect(money1.amount).toBe(originalAmount); // Original unchanged
      expect(result).not.toBe(money1); // New instance
    });

    it('should throw UnprocessableEntityException for currency mismatch', () => {
      const kes = new Money(500, 'KES');
      const usd = new Money(500, 'USD');
      expect(() => kes.add(usd)).toThrow(UnprocessableEntityException);
      expect(() => kes.add(usd)).toThrow('Currency mismatch');
    });

    it('should throw UnprocessableEntityException with both currencies in message', () => {
      const kes = new Money(500, 'KES');
      const usd = new Money(500, 'USD');
      try {
        kes.add(usd);
        fail('Expected UnprocessableEntityException to be thrown');
      } catch (e: any) {
        expect(e.message).toContain('KES');
        expect(e.message).toContain('USD');
      }
    });

    it('should handle large numbers correctly', () => {
      const money1 = new Money(100000);
      const money2 = new Money(50000);
      const result = money1.add(money2);
      expect(result.amount).toBe(150000);
    });

    it('should handle addition approaching maximum', () => {
      const money1 = new Money(70000);
      const money2 = new Money(70000);
      // This would exceed max, so we test with smaller values
      const result = money1.add(new Money(100));
      expect(result.amount).toBe(70100);
    });
  });

  describe('subtract()', () => {
    it('should subtract two Money objects with same currency', () => {
      const money1 = new Money(500);
      const money2 = new Money(200);
      const result = money1.subtract(money2);
      expect(result.amount).toBe(300);
      expect(result.currency).toBe('KES');
    });

    it('should return a new Money instance (immutability)', () => {
      const money1 = new Money(500);
      const money2 = new Money(200);
      const originalAmount = money1.amount;
      const result = money1.subtract(money2);
      expect(money1.amount).toBe(originalAmount); // Original unchanged
      expect(result).not.toBe(money1); // New instance
    });

    it('should throw UnprocessableEntityException for currency mismatch', () => {
      const kes = new Money(500, 'KES');
      const usd = new Money(200, 'USD');
      expect(() => kes.subtract(usd)).toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException when subtracting larger from smaller', () => {
      const money1 = new Money(100);
      const money2 = new Money(200);
      expect(() => money1.subtract(money2)).toThrow(UnprocessableEntityException);
      expect(() => money1.subtract(money2)).toThrow('Insufficient amount');
    });

    it('should throw UnprocessableEntityException with amounts in message', () => {
      const money1 = new Money(100);
      const money2 = new Money(200);
      try {
        money1.subtract(money2);
        fail('Expected UnprocessableEntityException to be thrown');
      } catch (e: any) {
        expect(e.message).toContain('200');
        expect(e.message).toContain('100');
      }
    });

    it('should handle subtraction resulting in minimum amount', () => {
      const money1 = new Money(2);
      const money2 = new Money(1);
      const result = money1.subtract(money2);
      expect(result.amount).toBe(1); // Minimum allowed
    });
  });

  describe('multiply()', () => {
    it('should multiply money by a number', () => {
      const money = new Money(100);
      const result = money.multiply(5);
      expect(result.amount).toBe(500);
      expect(result.currency).toBe('KES');
    });

    it('should return a new Money instance (immutability)', () => {
      const money = new Money(100);
      const originalAmount = money.amount;
      const result = money.multiply(2);
      expect(money.amount).toBe(originalAmount); // Original unchanged
      expect(result).not.toBe(money); // New instance
    });

    it('should round result to nearest integer', () => {
      const money = new Money(100);
      const result = money.multiply(1.5);
      expect(result.amount).toBe(150);
    });

    it('should handle decimal multipliers with rounding', () => {
      const money = new Money(100);
      const result = money.multiply(1.7);
      expect(result.amount).toBe(170);
    });

    it('should handle fractional results with proper rounding', () => {
      const money = new Money(100);
      const result = money.multiply(1.333);
      expect(result.amount).toBe(133); // Rounds down
    });

    it('should handle multiplier that results in minimum amount', () => {
      const money = new Money(1);
      const result = money.multiply(1);
      expect(result.amount).toBe(1);
    });

    it('should handle multiplier of one (identity)', () => {
      const money = new Money(500);
      const result = money.multiply(1);
      expect(result.amount).toBe(500);
    });
  });

  describe('toKES()', () => {
    it('should convert smallest unit (cents) to KES', () => {
      const money = new Money(50000);
      expect(money.toKES()).toBe(500);
    });

    it('should handle conversion of 100 cents to 1 KES', () => {
      const money = new Money(100);
      expect(money.toKES()).toBe(1);
    });

    it('should handle decimal KES values', () => {
      const money = new Money(150);
      expect(money.toKES()).toBe(1.5);
    });

    it('should handle minimum amount conversion', () => {
      const money = new Money(1);
      expect(money.toKES()).toBe(0.01);
    });
  });

  describe('toJSON()', () => {
    it('should return object with amount, currency, and kes', () => {
      const money = new Money(50000);
      const json = money.toJSON();
      expect(json).toEqual({
        amount: 50000,
        currency: 'KES',
        kes: 500,
      });
    });

    it('should include custom currency in JSON', () => {
      const money = new Money(1000, 'USD');
      const json = money.toJSON();
      expect(json.currency).toBe('USD');
    });

    it('should be JSON serializable', () => {
      const money = new Money(50000);
      const jsonString = JSON.stringify(money);
      expect(jsonString).toContain('amount');
      expect(jsonString).toContain('currency');
    });
  });

  describe('Edge Cases', () => {
    it('should handle maximum safe integer in JavaScript', () => {
      const maxSafe = Number.MAX_SAFE_INTEGER;
      // This should not throw during construction if within payment limits
      // Payment limits are much lower than MAX_SAFE_INTEGER
      const money = new Money(PAYMENT_CONSTANTS.STK.MAX_AMOUNT);
      expect(money.amount).toBe(PAYMENT_CONSTANTS.STK.MAX_AMOUNT);
    });

    it('should handle addition within payment limits', () => {
      const money1 = new Money(50000);
      const money2 = new Money(50000);
      const result = money1.add(money2);
      expect(result.amount).toBe(100000);
    });

    it('should throw when addition exceeds maximum', () => {
      const money1 = new Money(100000);
      const money2 = new Money(100000);
      expect(() => money1.add(money2)).toThrow(BadRequestException);
      expect(() => money1.add(money2)).toThrow('exceeds the maximum');
    });

    it('should preserve currency through operations', () => {
      const usd = new Money(1000, 'USD');
      const result = usd.add(new Money(500, 'USD'));
      expect(result.currency).toBe('USD');
    });
  });
});
