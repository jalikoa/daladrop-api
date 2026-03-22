import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { PaymentsService } from '../payments.service';
import { InitiateStkUseCase } from '../use-cases/initiate-stk.usecase';
import { GetPaymentUseCase } from '../use-cases/get-payment.usecase';
import { GetMerchantPaymentsUseCase } from '../use-cases/get-merchant-payments.usecase';
import { GetAllPaymentsUseCase } from '../use-cases/get-all-payments.usecase';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PhoneNumber } from '../value-objects/phone-number.vo';
import { Money } from '../value-objects/money.vo';
import { PAYMENT_CONSTANTS } from '../constants/payment.constants';

// ─── fixtures ─────────────────────────────────────────────────────────────────
const mockSession = {
  id: 1,
  session_uuid: 'a3f8c4d2-1234-5678-abcd-ef0123456789',
  merchant_id: 1,
  customer_phone: '254712345678',
  amount: 500,
  currency: 'KES',
  status: PaymentStatus.PENDING,
  payment_type: 'NFC_TAP',
  checkout_request_id: null,
  merchant_request_id: null,
  mpesa_receipt: null,
  description: null,
  metadata: null,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  completed_at: null,
  isCompleted: () => false,
  isPending: () => true,
  toJSON: () => mockSession,
};

const mockStkUseCase = { execute: jest.fn() };
const mockGetPaymentUseCase = { byId: jest.fn(), byUuid: jest.fn() };
const mockGetMerchantPaymentsUseCase = { execute: jest.fn(), getStatistics: jest.fn() };
const mockGetAllPaymentsUseCase = { execute: jest.fn() };

// ─── PaymentsService ──────────────────────────────────────────────────────────
describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: InitiateStkUseCase, useValue: mockStkUseCase },
        { provide: GetPaymentUseCase, useValue: mockGetPaymentUseCase },
        { provide: GetMerchantPaymentsUseCase, useValue: mockGetMerchantPaymentsUseCase },
        { provide: GetAllPaymentsUseCase, useValue: mockGetAllPaymentsUseCase },
      ],
    }).compile();
    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('initiateStk()', () => {
    it('returns session DTO on successful initiation', async () => {
      mockStkUseCase.execute.mockResolvedValue(mockSession);
      const result = await service.initiateStk({
        amount: 500, phone: '0712345678', merchant_id: 1,
      } as any);
      expect(result.session_uuid).toBe('a3f8c4d2-1234-5678-abcd-ef0123456789');
    });

    it('propagates BadRequestException for invalid phone', async () => {
      mockStkUseCase.execute.mockRejectedValue(new BadRequestException('Invalid phone number'));
      await expect(
        service.initiateStk({ amount: 500, phone: 'invalid', merchant_id: 1 } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne()', () => {
    it('returns payment DTO by ID', async () => {
      mockGetPaymentUseCase.byId.mockResolvedValue(mockSession);
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
    });
  });

  describe('findByUuid()', () => {
    it('returns payment DTO by UUID', async () => {
      mockGetPaymentUseCase.byUuid.mockResolvedValue(mockSession);
      const result = await service.findByUuid('a3f8c4d2-1234-5678-abcd-ef0123456789');
      expect(result.session_uuid).toBe('a3f8c4d2-1234-5678-abcd-ef0123456789');
    });
  });

  describe('findByMerchant()', () => {
    it('returns paginated payment list', async () => {
      mockGetMerchantPaymentsUseCase.execute.mockResolvedValue({ data: [mockSession], total: 1 });
      const result = await service.findByMerchant(1, 1, 10);
      expect(result.total).toBe(1);
      expect(result.data[0].session_uuid).toBe('a3f8c4d2-1234-5678-abcd-ef0123456789');
    });

    it('filters by status when provided', async () => {
      mockGetMerchantPaymentsUseCase.execute.mockResolvedValue({ data: [], total: 0 });
      await service.findByMerchant(1, 1, 10, PaymentStatus.COMPLETED);
      expect(mockGetMerchantPaymentsUseCase.execute).toHaveBeenCalledWith(
        1, 1, 10, PaymentStatus.COMPLETED,
      );
    });
  });

  describe('getStatistics()', () => {
    it('returns aggregated stats for date range', async () => {
      const stats = { count: 5, totalAmount: 2500 };
      mockGetMerchantPaymentsUseCase.getStatistics.mockResolvedValue(stats);
      const from = new Date('2026-01-01');
      const to = new Date('2026-03-01');
      const result = await service.getStatistics(1, from, to);
      expect(result.count).toBe(5);
      expect(result.totalAmount).toBe(2500);
    });
  });
});

// ─── PhoneNumber value object ─────────────────────────────────────────────────
describe('PhoneNumber value object', () => {
  it('normalises 07XX number to 2547XX', () => {
    const p = new PhoneNumber('0712345678');
    expect(p.toString()).toBe('254712345678');
  });

  it('accepts already-normalised 254 number', () => {
    const p = new PhoneNumber('254712345678');
    expect(p.toString()).toBe('254712345678');
  });

  it('accepts +254 format', () => {
    const p = new PhoneNumber('+254712345678');
    expect(p.toString()).toBe('254712345678');
  });

  it('normalises 9-digit number without country code', () => {
    const p = new PhoneNumber('712345678');
    expect(p.toString()).toBe('254712345678');
  });

  it('throws BadRequestException for invalid number', () => {
    expect(() => new PhoneNumber('12345')).toThrow(BadRequestException);
  });

  it('throws BadRequestException with descriptive message', () => {
    expect(() => new PhoneNumber('00000000000')).toThrow(/Invalid Kenyan phone number/i);
  });

  it('toDisplay() returns formatted string', () => {
    const p = new PhoneNumber('254712345678');
    expect(p.toDisplay()).toBe('+254 712 345 678');
  });
});

// ─── Money value object ───────────────────────────────────────────────────────
describe('Money value object', () => {
  it('creates a valid money amount', () => {
    const m = new Money(500);
    expect(m.amount).toBe(500);
    expect(m.currency).toBe('KES');
  });

  it('throws BadRequestException below minimum', () => {
    expect(() => new Money(PAYMENT_CONSTANTS.STK.MIN_AMOUNT - 1)).toThrow(BadRequestException);
  });

  it('throws BadRequestException above maximum', () => {
    expect(() => new Money(PAYMENT_CONSTANTS.STK.MAX_AMOUNT + 1)).toThrow(BadRequestException);
  });

  it('throws BadRequestException for non-integer amount', () => {
    expect(() => new Money(1.5)).toThrow(BadRequestException);
  });

  it('error message includes the actual amount', () => {
    expect(() => new Money(PAYMENT_CONSTANTS.STK.MAX_AMOUNT + 1)).toThrow(
      /exceed|maximum/i,
    );
  });

  it('add() returns sum when currencies match', () => {
    const result = new Money(300).add(new Money(200));
    expect(result.amount).toBe(500);
  });

  it('add() throws UnprocessableEntityException on currency mismatch', () => {
    const kes = new Money(500, 'KES');
    const usd = new Money(500, 'USD');
    expect(() => kes.add(usd)).toThrow(UnprocessableEntityException);
  });

  it('subtract() returns difference when currencies match', () => {
    const result = new Money(500).subtract(new Money(200));
    expect(result.amount).toBe(300);
  });

  it('subtract() throws UnprocessableEntityException on insufficient amount', () => {
    expect(() => new Money(100).subtract(new Money(200))).toThrow(UnprocessableEntityException);
  });

  it('toKES() converts smallest unit to KES', () => {
    expect(new Money(50000).toKES()).toBe(500);
  });

  it('multiply() rounds result to nearest integer', () => {
    const result = new Money(100).multiply(1.5);
    expect(result.amount).toBe(150);
    expect(Number.isInteger(result.amount)).toBe(true);
  });
});