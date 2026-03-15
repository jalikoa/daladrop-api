import { BadRequestException } from '@nestjs/common';
import { QRCodeValueObject } from '../value-objects/qr-code.vo';
import { QR_CONSTANTS } from '../constants/qr.constants';

// ─── QRCodeValueObject ────────────────────────────────────────────────────────
// These tests verify the FIXED version (throws BadRequestException, not Error)
describe('QRCodeValueObject', () => {
  const validUrl = 'https://pay.example.com/pay?token=abc123';

  describe('valid construction', () => {
    it('creates with a valid URL and defaults', () => {
      const vo = new QRCodeValueObject(validUrl);
      expect(vo.data).toBe(validUrl);
      expect(vo.size).toBe(QR_CONSTANTS.DEFAULT_SIZE);
      expect(vo.margin).toBe(QR_CONSTANTS.DEFAULT_MARGIN);
      expect(vo.errorCorrection).toBe('M');
    });

    it('creates with explicit parameters', () => {
      const vo = new QRCodeValueObject(validUrl, 500, 'H', 4);
      expect(vo.size).toBe(500);
      expect(vo.errorCorrection).toBe('H');
      expect(vo.margin).toBe(4);
    });

    it('getOptions() returns correct qrcode library options shape', () => {
      const vo = new QRCodeValueObject(validUrl, 400, 'Q', 3);
      const opts = vo.getOptions();
      expect(opts.width).toBe(400);
      expect(opts.margin).toBe(3);
      expect(opts.errorCorrectionLevel).toBe('Q');
    });

    it('toJSON() returns all properties', () => {
      const vo = new QRCodeValueObject(validUrl, 300, 'M', 2);
      const json = vo.toJSON();
      expect(json.data).toBe(validUrl);
      expect(json.size).toBe(300);
    });
  });

  describe('validation — throws BadRequestException (not bare Error)', () => {
    it('throws BadRequestException for empty data', () => {
      expect(() => new QRCodeValueObject('')).toThrow(BadRequestException);
    });

    it('throws BadRequestException for data exceeding max length', () => {
      const tooLong = 'a'.repeat(QR_CONSTANTS.MAX_URL_LENGTH + 1);
      expect(() => new QRCodeValueObject(tooLong)).toThrow(BadRequestException);
    });

    it('error message includes actual vs max length for long data', () => {
      const tooLong = 'a'.repeat(QR_CONSTANTS.MAX_URL_LENGTH + 1);
      expect(() => new QRCodeValueObject(tooLong)).toThrow(/exceed|maximum/i);
    });

    it('throws BadRequestException for size below 100', () => {
      expect(() => new QRCodeValueObject(validUrl, 99)).toThrow(BadRequestException);
    });

    it('throws BadRequestException for size above 1000', () => {
      expect(() => new QRCodeValueObject(validUrl, 1001)).toThrow(BadRequestException);
    });

    it('error message includes the bad size value', () => {
      expect(() => new QRCodeValueObject(validUrl, 50)).toThrow(/50/);
    });

    it('throws BadRequestException for margin below 1', () => {
      expect(() => new QRCodeValueObject(validUrl, 300, 'M', 0)).toThrow(BadRequestException);
    });

    it('throws BadRequestException for margin above 10', () => {
      expect(() => new QRCodeValueObject(validUrl, 300, 'M', 11)).toThrow(BadRequestException);
    });

    it('accepts boundary values: size=100 and size=1000', () => {
      expect(() => new QRCodeValueObject(validUrl, 100)).not.toThrow();
      expect(() => new QRCodeValueObject(validUrl, 1000)).not.toThrow();
    });

    it('accepts boundary values: margin=1 and margin=10', () => {
      expect(() => new QRCodeValueObject(validUrl, 300, 'M', 1)).not.toThrow();
      expect(() => new QRCodeValueObject(validUrl, 300, 'M', 10)).not.toThrow();
    });
  });
});