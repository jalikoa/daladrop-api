import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { MerchantsService } from '../merchants.service';
import { CreateMerchantUseCase } from '../use-cases/create-merchant.usecase';
import { FindMerchantUseCase } from '../use-cases/find-merchant.usecase';
import { GeneratePaymentLinkUseCase } from '../use-cases/generate-payment-link.usecase';
import { MerchantStatus, MerchantVerificationStatus } from '../enums/merchant-status.enum';

// ─── shared fixture ───────────────────────────────────────────────────────────
const mockMerchantEntity = {
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
  metadata: {},
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  isActive: () => true,
  normalizeData: () => {},
  toJSON: () => mockMerchantEntity,
};

const pendingMerchantEntity = {
  ...mockMerchantEntity,
  id: 2,
  status: MerchantStatus.PENDING,
  verification_status: MerchantVerificationStatus.UNVERIFIED,
  isActive: () => false,
};

const mockMerchantRepo = {
  findAll: jest.fn(),
  update: jest.fn(),
  countActive: jest.fn(),
};

const mockCreateUseCase = { execute: jest.fn() };
const mockFindUseCase = { byId: jest.fn(), byUserId: jest.fn() };
const mockGenerateLinkUseCase = { execute: jest.fn() };

// ─── MerchantsService ─────────────────────────────────────────────────────────
describe('MerchantsService', () => {
  let service: MerchantsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantsService,
        { provide: CreateMerchantUseCase, useValue: mockCreateUseCase },
        { provide: FindMerchantUseCase, useValue: mockFindUseCase },
        { provide: GeneratePaymentLinkUseCase, useValue: mockGenerateLinkUseCase },
        { provide: 'IMerchantRepository', useValue: mockMerchantRepo },
      ],
    }).compile();
    service = module.get<MerchantsService>(MerchantsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('create()', () => {
    it('creates a merchant and returns DTO', async () => {
      mockCreateUseCase.execute.mockResolvedValue(mockMerchantEntity);
      const result = await service.create(2, {
        business_name: 'DemoShop',
        paybill_number: '123456789',
        account_number: '123456',
      });
      expect(result.id).toBe(1);
      expect(result.business_name).toBe('DemoShop');
    });
  });

  describe('findOne()', () => {
    it('returns merchant DTO by ID', async () => {
      mockFindUseCase.byId.mockResolvedValue(mockMerchantEntity);
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
    });

    it('propagates NotFoundException for unknown merchant', async () => {
      mockFindUseCase.byId.mockRejectedValue(new NotFoundException('Merchant not found'));
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUserId()', () => {
    it('returns merchant DTO for owner user', async () => {
      mockFindUseCase.byUserId.mockResolvedValue(mockMerchantEntity);
      const result = await service.findByUserId(2);
      expect(result.user_id).toBe(2);
    });
  });

  describe('generatePaymentLink()', () => {
    it('delegates to GeneratePaymentLinkUseCase', async () => {
      const mockLink = {
        merchant_id: 1, merchant_name: 'DemoShop',
        payment_url: 'https://pay.example.com/pay?token=abc',
        encrypted_token: 'abc', qr_code_data_url: '', expires_at: new Date(), created_at: new Date(),
      };
      mockGenerateLinkUseCase.execute.mockResolvedValue(mockLink);
      const result = await service.generatePaymentLink(1, true);
      expect(result.payment_url).toContain('pay?token=');
      expect(mockGenerateLinkUseCase.execute).toHaveBeenCalledWith({ merchantId: 1, includeQr: true });
    });
  });

  describe('findAll()', () => {
    it('returns paginated list', async () => {
      mockMerchantRepo.findAll.mockResolvedValue({ data: [mockMerchantEntity], total: 1 });
      const result = await service.findAll(1, 10);
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe(1);
    });
  });

  describe('countActive()', () => {
    it('returns active merchant count from repo', async () => {
      mockMerchantRepo.countActive.mockResolvedValue(5);
      const count = await service.countActive();
      expect(count).toBe(5);
    });
  });
});

// ─── GeneratePaymentLinkUseCase ───────────────────────────────────────────────
describe('GeneratePaymentLinkUseCase', () => {
  let useCase: GeneratePaymentLinkUseCase;

  const mockEncryptionService = { encryptPayload: jest.fn().mockReturnValue('encrypted_token') };
  const mockQrService = {
    generate: jest.fn().mockResolvedValue('data:image/png;base64,fakeqr'),
  };
  const mockConfigService = { get: jest.fn().mockReturnValue('https://pay.example.com') };
  const mockEventEmitter = { emit: jest.fn() };
  const mockMerchantRepoForUseCase = { findById: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneratePaymentLinkUseCase,
        { provide: 'IMerchantRepository', useValue: mockMerchantRepoForUseCase },
        { provide: 'EncryptionService', useValue: mockEncryptionService },
        { provide: 'QrService', useValue: mockQrService },
        { provide: 'ConfigService', useValue: mockConfigService },
        { provide: 'EventEmitter2', useValue: mockEventEmitter },
      ],
    })
      .overrideProvider('EncryptionService')
      .useValue(mockEncryptionService)
      .overrideProvider('QrService')
      .useValue(mockQrService)
      .overrideProvider('ConfigService')
      .useValue(mockConfigService)
      .overrideProvider('EventEmitter2')
      .useValue(mockEventEmitter)
      .compile();
    useCase = module.get<GeneratePaymentLinkUseCase>(GeneratePaymentLinkUseCase);
  });

  it('throws NotFoundException when merchant does not exist', async () => {
    mockMerchantRepoForUseCase.findById.mockResolvedValue(null);
    await expect(useCase.execute({ merchantId: 999 })).rejects.toThrow(NotFoundException);
  });

  it('throws UnprocessableEntityException when merchant is not active', async () => {
    mockMerchantRepoForUseCase.findById.mockResolvedValue(pendingMerchantEntity);
    await expect(useCase.execute({ merchantId: 2 })).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws UnprocessableEntityException with descriptive message', async () => {
    mockMerchantRepoForUseCase.findById.mockResolvedValue(pendingMerchantEntity);
    await expect(useCase.execute({ merchantId: 2 })).rejects.toThrow(
      /not active or verified/i,
    );
  });
});