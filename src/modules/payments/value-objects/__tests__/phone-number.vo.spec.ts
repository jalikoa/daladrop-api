import { BadRequestException } from '@nestjs/common';
import { PhoneNumber } from '../phone-number.vo';

/**
 * Unit Tests for PhoneNumber Value Object
 * 
 * Tests the PhoneNumber value object in isolation - no database,
 * no network calls, no external dependencies.
 */
describe('PhoneNumber Value Object - Unit Tests', () => {
  describe('Construction and Normalization', () => {
    it('should normalize 07XX format to 2547XX', () => {
      const phone = new PhoneNumber('0712345678');
      expect(phone.toString()).toBe('254712345678');
    });

    it('should normalize 01XX format to 2541XX', () => {
      const phone = new PhoneNumber('0112345678');
      expect(phone.toString()).toBe('254112345678');
    });

    it('should accept already normalized 254 format', () => {
      const phone = new PhoneNumber('254712345678');
      expect(phone.toString()).toBe('254712345678');
    });

    it('should normalize +254 format', () => {
      const phone = new PhoneNumber('+254712345678');
      expect(phone.toString()).toBe('254712345678');
    });

    it('should normalize 9-digit number without country code', () => {
      const phone = new PhoneNumber('712345678');
      expect(phone.toString()).toBe('254712345678');
    });

    it('should normalize 9-digit number starting with 1', () => {
      const phone = new PhoneNumber('112345678');
      expect(phone.toString()).toBe('254112345678');
    });

    it('should handle phone number with spaces', () => {
      const phone = new PhoneNumber('0712 345 678');
      expect(phone.toString()).toBe('254712345678');
    });

    it('should handle phone number with dashes', () => {
      const phone = new PhoneNumber('0712-345-678');
      expect(phone.toString()).toBe('254712345678');
    });

    it('should handle phone number with mixed formatting', () => {
      const phone = new PhoneNumber('+254 712-345 678');
      expect(phone.toString()).toBe('254712345678');
    });

    it('should handle phone number with parentheses', () => {
      const phone = new PhoneNumber('0712(345)678');
      expect(phone.toString()).toBe('254712345678');
    });
  });

  describe('Validation', () => {
    it('should accept valid Safaricom number (7XX)', () => {
      expect(() => new PhoneNumber('0712345678')).not.toThrow();
      expect(() => new PhoneNumber('0799999999')).not.toThrow();
    });

    it('should accept valid Airtel number (1XX)', () => {
      expect(() => new PhoneNumber('0112345678')).not.toThrow();
      expect(() => new PhoneNumber('0159999999')).not.toThrow();
    });

    it('should throw BadRequestException for too short number', () => {
      expect(() => new PhoneNumber('12345')).toThrow(BadRequestException);
      expect(() => new PhoneNumber('12345')).toThrow('Invalid Kenyan phone number');
    });

    it('should throw BadRequestException for too long number', () => {
      expect(() => new PhoneNumber('071234567890')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid country code', () => {
      expect(() => new PhoneNumber('255712345678')).toThrow(BadRequestException);
      expect(() => new PhoneNumber('255712345678')).toThrow('Invalid Kenyan phone number');
    });

    it('should throw BadRequestException for invalid prefix', () => {
      expect(() => new PhoneNumber('254912345678')).toThrow(BadRequestException);
      expect(() => new PhoneNumber('254912345678')).toThrow('Invalid Kenyan phone number');
    });

    it('should throw BadRequestException with descriptive error message', () => {
      try {
        new PhoneNumber('00000000000');
        fail('Expected BadRequestException to be thrown');
      } catch (e: any) {
        expect(e.message).toContain('Invalid Kenyan phone number');
        expect(e.message).toContain('2547XXXXXXXX');
        expect(e.message).toContain('2541XXXXXXXX');
      }
    });

    it('should throw BadRequestException for number starting with 0 but wrong length', () => {
      expect(() => new PhoneNumber('071234567')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for number with letters', () => {
      expect(() => new PhoneNumber('071234567a')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty string', () => {
      expect(() => new PhoneNumber('')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for only special characters', () => {
      expect(() => new PhoneNumber('---')).toThrow(BadRequestException);
    });
  });

  describe('toString()', () => {
    it('should return the normalized phone number as string', () => {
      const phone = new PhoneNumber('0712345678');
      expect(phone.toString()).toBe('254712345678');
    });

    it('should return string without formatting', () => {
      const phone = new PhoneNumber('+254 712-345 678');
      expect(phone.toString()).toBe('254712345678');
      expect(phone.toString()).not.toContain(' ');
      expect(phone.toString()).not.toContain('-');
      expect(phone.toString()).not.toContain('+');
    });
  });

  describe('toDisplay()', () => {
    it('should format number with + and spaces for readability', () => {
      const phone = new PhoneNumber('0712345678');
      expect(phone.toDisplay()).toBe('+254 712 345 678');
    });

    it('should format Airtel number correctly', () => {
      const phone = new PhoneNumber('0112345678');
      expect(phone.toDisplay()).toBe('+254 112 345 678');
    });

    it('should work with already normalized input', () => {
      const phone = new PhoneNumber('254712345678');
      expect(phone.toDisplay()).toBe('+254 712 345 678');
    });
  });

  describe('toJSON()', () => {
    it('should return the normalized phone number string', () => {
      const phone = new PhoneNumber('0712345678');
      expect(phone.toJSON()).toBe('254712345678');
    });

    it('should be JSON serializable', () => {
      const phone = new PhoneNumber('0712345678');
      const jsonString = JSON.stringify(phone);
      expect(jsonString).toBe('"254712345678"');
    });
  });

  describe('Immutability', () => {
    it('should not allow modification of internal value', () => {
      const phone = new PhoneNumber('0712345678');
      const first = phone.toString();
      const second = phone.toString();
      expect(first).toBe(second);
    });

    it('should maintain same value across multiple method calls', () => {
      const phone = new PhoneNumber('0712345678');
      expect(phone.toString()).toBe('254712345678');
      expect(phone.toDisplay()).toBe('+254 712 345 678');
      expect(phone.toJSON()).toBe('254712345678');
      expect(phone.toString()).toBe('254712345678'); // Still the same
    });
  });

  describe('Edge Cases', () => {
    it('should handle phone number at boundary of valid range', () => {
      // Lowest valid Safaricom number
      expect(() => new PhoneNumber('254700000000')).not.toThrow();
      // Highest valid Safaricom number
      expect(() => new PhoneNumber('254799999999')).not.toThrow();
    });

    it('should handle Airtel boundary numbers', () => {
      // Lowest valid Airtel number
      expect(() => new PhoneNumber('254100000000')).not.toThrow();
      // Highest valid Airtel number
      expect(() => new PhoneNumber('254199999999')).not.toThrow();
    });

    it('should reject numbers just outside valid range', () => {
      expect(() => new PhoneNumber('254699999999')).toThrow(BadRequestException);
      expect(() => new PhoneNumber('254800000000')).toThrow(BadRequestException);
    });

    it('should handle maximum length valid number', () => {
      const phone = new PhoneNumber('254799999999');
      expect(phone.toString().length).toBe(12);
    });
  });

  describe('Comparison', () => {
    it('should normalize different formats to same value', () => {
      const phone1 = new PhoneNumber('0712345678');
      const phone2 = new PhoneNumber('+254712345678');
      const phone3 = new PhoneNumber('254712345678');
      const phone4 = new PhoneNumber('712345678');
      
      expect(phone1.toString()).toBe(phone2.toString());
      expect(phone2.toString()).toBe(phone3.toString());
      expect(phone3.toString()).toBe(phone4.toString());
    });

    it('should produce same display format for different inputs', () => {
      const phone1 = new PhoneNumber('0712345678');
      const phone2 = new PhoneNumber('+254712345678');
      expect(phone1.toDisplay()).toBe(phone2.toDisplay());
    });
  });
});
