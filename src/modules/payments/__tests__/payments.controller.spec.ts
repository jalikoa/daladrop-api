import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PaymentsController } from '../payments.controller';
import { PaymentsService } from '../payments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PaymentOwnerGuard } from '../guards/payment-owner.guard';
import { PaymentStatus } from '../enums/payment-status.enum';

const allowAll = { canActivate: () => true };

const mockSessionDto = {
  id: 1,
  session_uuid: 'a3f8c4d2-1234-5678-abcd-ef0123456789',
  merchant_id: 1,
  customer_phone: '254712345678',
  amount: 500,
  currency: 'KES',
  status: PaymentStatus.PENDING,
  payment_type: 'NFC_TAP',
  checkout_request_id: null,
  mpesa_receipt: null,
  created_at: new Date(),
  updated_at: new Date(),
  completed_at: null,
};

const mockPaymentsService = {
  initiateStk: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByUuid: jest.fn(),
  findByMerchant: jest.fn(),
  getStatistics: jest.fn(),
};

describe('PaymentsController', () => {
  let controller: PaymentsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockPaymentsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue(allowAll)
      .overrideGuard(RolesGuard).useValue(allowAll)
      .overrideGuard(PaymentOwnerGuard).useValue(allowAll)
      .compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  describe('POST /payments/stk', () => {
    it('returns structured STK response on success', async () => {
      mockPaymentsService.initiateStk.mockResolvedValue(mockSessionDto);
      const result = await controller.initiateStk({
        amount: 500, phone: '0712345678', merchant_id: 1,
      } as any);
      expect(result.success).toBe(true);
      expect(result.payload.session_uuid).toBe('a3f8c4d2-1234-5678-abcd-ef0123456789');
      expect(result.payload.response_code).toBe('0');
    });

    it('includes timestamp in response', async () => {
      mockPaymentsService.initiateStk.mockResolvedValue(mockSessionDto);
      const result = await controller.initiateStk({ amount: 500, phone: '0712345678', merchant_id: 1 } as any);
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('GET /payments', () => {
    it('returns results when merchant_id is provided', async () => {
      mockPaymentsService.findByMerchant.mockResolvedValue({ data: [mockSessionDto], total: 1 });
      const result = await controller.findAll(1, 10, undefined, 1);
      expect(result.total).toBe(1);
    });

    it('returns empty list when no merchant_id provided', async () => {
      mockPaymentsService.findAll.mockResolvedValue({ data: [], total: 0 });
      const result = await controller.findAll(1, 10, undefined, undefined);
      expect(result).toEqual({ data: [], total: 0 });
    });

    it('passes status filter to service', async () => {
      mockPaymentsService.findByMerchant.mockResolvedValue({ data: [], total: 0 });
      await controller.findAll(1, 10, PaymentStatus.COMPLETED, 1);
      expect(mockPaymentsService.findByMerchant).toHaveBeenCalledWith(
        1, 1, 10, PaymentStatus.COMPLETED,
      );
    });
  });

  describe('GET /payments/:id', () => {
    it('returns payment by ID', async () => {
      mockPaymentsService.findOne.mockResolvedValue(mockSessionDto);
      const result = await controller.findOne(1);
      expect(result.id).toBe(1);
    });

    it('propagates NotFoundException for unknown payment', async () => {
      mockPaymentsService.findOne.mockRejectedValue(new NotFoundException());
      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /payments/session/:uuid', () => {
    it('returns payment by UUID for polling', async () => {
      mockPaymentsService.findByUuid.mockResolvedValue(mockSessionDto);
      const result = await controller.findByUuid('a3f8c4d2-1234-5678-abcd-ef0123456789');
      expect(result.session_uuid).toBe('a3f8c4d2-1234-5678-abcd-ef0123456789');
    });
  });

  describe('GET /payments/merchant/:merchantId', () => {
    it('returns merchant payments with pagination', async () => {
      mockPaymentsService.findByMerchant.mockResolvedValue({ data: [mockSessionDto], total: 1 });
      const result = await controller.getMerchantPayments(1, 1, 10);
      expect(result.total).toBe(1);
    });
  });

  describe('GET /payments/merchant/:merchantId/statistics', () => {
    it('returns stats for a date range', async () => {
      const stats = { count: 10, totalAmount: 5000 };
      mockPaymentsService.getStatistics.mockResolvedValue(stats);
      const result = await controller.getStatistics(1, '2026-01-01', '2026-03-15');
      expect(result.count).toBe(10);
      expect(result.totalAmount).toBe(5000);
    });

    it('defaults date range to last 30 days when not provided', async () => {
      mockPaymentsService.getStatistics.mockResolvedValue({ count: 0, totalAmount: 0 });
      await controller.getStatistics(1);
      const call = mockPaymentsService.getStatistics.mock.calls[0];
      const [, startDate, endDate] = call;
      const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(30, 0);
    });
  });
});