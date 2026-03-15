import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { MerchantsController } from '../merchants.controller';
import { MerchantsService } from '../merchants.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { MerchantOwnerGuard } from '../guards/merchant-owner.guard';
import { MerchantStatus, MerchantVerificationStatus } from '../enums/merchant-status.enum';

const allowAll = { canActivate: () => true };

const mockMerchantDto = {
  id: 1,
  user_id: 2,
  business_name: 'DemoShop',
  business_email: null,
  business_phone: null,
  logo_url: null,
  paybill_number: '123456789',
  account_number: '123456',
  status: MerchantStatus.ACTIVE,
  verification_status: MerchantVerificationStatus.VERIFIED,
  created_at: new Date('2026-01-01').toISOString() as any,
  updated_at: new Date('2026-01-01').toISOString() as any,
  is_active: true,
};

const mockPaymentLink = {
  merchant_id: 1,
  merchant_name: 'DemoShop',
  payment_url: 'https://pay.example.com/pay?token=enc123',
  encrypted_token: 'enc123',
  qr_code_data_url: 'data:image/png;base64,fakeqr',
  expires_at: new Date(),
  created_at: new Date(),
};

const mockMerchantsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByUserId: jest.fn(),
  update: jest.fn(),
  generatePaymentLink: jest.fn(),
};

describe('MerchantsController', () => {
  let controller: MerchantsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantsController],
      providers: [{ provide: MerchantsService, useValue: mockMerchantsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue(allowAll)
      .overrideGuard(RolesGuard).useValue(allowAll)
      .overrideGuard(MerchantOwnerGuard).useValue(allowAll)
      .compile();

    controller = module.get<MerchantsController>(MerchantsController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  describe('POST /merchants', () => {
    it('creates merchant for the given user_id', async () => {
      mockMerchantsService.create.mockResolvedValue(mockMerchantDto);
      const result = await controller.create(
        { business_name: 'DemoShop', paybill_number: '123456789', account_number: '123456' },
        2,
      );
      expect(result.id).toBe(1);
      expect(mockMerchantsService.create).toHaveBeenCalledWith(2, expect.any(Object));
    });
  });

  describe('GET /merchants', () => {
    it('returns paginated merchant list', async () => {
      mockMerchantsService.findAll.mockResolvedValue({ data: [mockMerchantDto], total: 1 });
      const result = await controller.findAll(1, 10);
      expect(result.total).toBe(1);
      expect(result.data[0].business_name).toBe('DemoShop');
    });
  });

  describe('GET /merchants/me', () => {
    it('returns merchant for authenticated user via req.user.id', async () => {
      mockMerchantsService.findByUserId.mockResolvedValue(mockMerchantDto);
      const result = await controller.findMyMerchant({ user: { id: 2 } } as any);
      expect(result.user_id).toBe(2);
      expect(mockMerchantsService.findByUserId).toHaveBeenCalledWith(2);
    });

    it('propagates NotFoundException when user has no merchant', async () => {
      mockMerchantsService.findByUserId.mockRejectedValue(new NotFoundException('No merchant'));
      await expect(
        controller.findMyMerchant({ user: { id: 99 } } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /merchants/:id', () => {
    it('returns merchant by ID', async () => {
      mockMerchantsService.findOne.mockResolvedValue(mockMerchantDto);
      const result = await controller.findOne(1);
      expect(result.id).toBe(1);
    });

    it('propagates NotFoundException for unknown merchant', async () => {
      mockMerchantsService.findOne.mockRejectedValue(new NotFoundException());
      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /merchants/:id/payment-link', () => {
    it('returns payment link with QR when includeQr defaults to true', async () => {
      mockMerchantsService.generatePaymentLink.mockResolvedValue(mockPaymentLink);
      const result = await controller.generatePaymentLink(1, 'true');
      expect(result.payment_url).toContain('token=');
      expect(mockMerchantsService.generatePaymentLink).toHaveBeenCalledWith(1, true);
    });

    it('passes includeQr=false when query is "false"', async () => {
      mockMerchantsService.generatePaymentLink.mockResolvedValue(mockPaymentLink);
      await controller.generatePaymentLink(1, 'false');
      expect(mockMerchantsService.generatePaymentLink).toHaveBeenCalledWith(1, false);
    });

    it('propagates UnprocessableEntityException for inactive merchant', async () => {
      mockMerchantsService.generatePaymentLink.mockRejectedValue(
        new UnprocessableEntityException('Merchant is not active or verified'),
      );
      await expect(controller.generatePaymentLink(2, 'true')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('PATCH /merchants/:id', () => {
    it('returns updated merchant', async () => {
      const updated = { ...mockMerchantDto, business_email: 'shop@demo.com' };
      mockMerchantsService.update.mockResolvedValue(updated);
      const result = await controller.update(1, { business_email: 'shop@demo.com' });
      expect(result.business_email).toBe('shop@demo.com');
    });
  });

  describe('GET /merchants/:id/cards', () => {
    it('returns stub empty cards array', async () => {
      const result = await controller.getMerchantCards(1);
      expect(result).toEqual({ cards: [] });
    });
  });
});