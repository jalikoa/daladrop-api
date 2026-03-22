import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NfcService } from '../nfc.service';
import { CreateNfcTagUseCase } from '../use-cases/create-nfc-tag.usecase';
import { DecodeTokenUseCase } from '../use-cases/decode-token.usecase';
import { NFC_CONSTANTS } from '../constants/nfc.constants';
import { MerchantStatus, MerchantVerificationStatus } from '../../merchants/enums/merchant-status.enum';
import { EncryptionService } from '../../../common/security/encryption.service';

// ─── fixtures ─────────────────────────────────────────────────────────────────
const mockActiveMerchant = {
  id: 1, user_id: 2, business_name: 'DemoShop',
  status: MerchantStatus.ACTIVE,
  verification_status: MerchantVerificationStatus.VERIFIED,
  isActive: () => true,
};

const mockInactiveMerchant = {
  ...mockActiveMerchant, id: 2,
  status: MerchantStatus.PENDING,
  verification_status: MerchantVerificationStatus.UNVERIFIED,
  isActive: () => false,
};

const mockNfcTag = {
  id: 1, merchant_id: 1, tag_uid: '04:AB:CD:EF:12:34',
  encrypted_payload: 'encrypted_data', is_active: true,
  description: 'Counter tag', created_at: new Date('2026-01-01'),
};

// ─── NfcService ───────────────────────────────────────────────────────────────
describe('NfcService', () => {
  let service: NfcService;

  const mockCreateUseCase = { execute: jest.fn() };
  const mockDecodeUseCase = { execute: jest.fn() };
  const mockNfcRepo = {
    findById: jest.fn(),
    findByMerchantId: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NfcService,
        { provide: CreateNfcTagUseCase, useValue: mockCreateUseCase },
        { provide: DecodeTokenUseCase, useValue: mockDecodeUseCase },
        { provide: 'INfcRepository', useValue: mockNfcRepo },
      ],
    }).compile();
    service = module.get<NfcService>(NfcService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('createTag()', () => {
    it('creates tag and returns response DTO', async () => {
      mockCreateUseCase.execute.mockResolvedValue(mockNfcTag);
      const result = await service.createTag(1, { tag_uid: '04:AB:CD:EF:12:34', description: 'Counter tag' });
      expect(result.id).toBe(1);
      expect(result.merchant_id).toBe(1);
      expect(result.tag_uid).toBe('04:AB:CD:EF:12:34');
    });

    it('propagates UnprocessableEntityException for inactive merchant', async () => {
      mockCreateUseCase.execute.mockRejectedValue(
        new UnprocessableEntityException('merchant is not active or verified'),
      );
      await expect(service.createTag(2, {})).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('findOne()', () => {
    it('returns tag response DTO when tag exists', async () => {
      mockNfcRepo.findById.mockResolvedValue(mockNfcTag);
      const result = await service.findOne(1);
      expect(result.id).toBe(1);
      expect(result.encrypted_payload).toBe('encrypted_data');
    });

    it('throws NotFoundException when tag does not exist', async () => {
      mockNfcRepo.findById.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('NotFoundException message includes the missing ID', async () => {
      mockNfcRepo.findById.mockResolvedValue(null);
      await expect(service.findOne(42)).rejects.toThrow(/42/);
    });
  });

  describe('findByMerchant()', () => {
    it('returns paginated tag list', async () => {
      mockNfcRepo.findByMerchantId.mockResolvedValue({ data: [mockNfcTag], total: 1 });
      const result = await service.findByMerchant(1, 1, 10);
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe(1);
    });

    it('returns empty list when merchant has no tags', async () => {
      mockNfcRepo.findByMerchantId.mockResolvedValue({ data: [], total: 0 });
      const result = await service.findByMerchant(1, 1, 10);
      expect(result.data).toHaveLength(0);
    });

    it('returns all tags when merchantId is null', async () => {
      mockNfcRepo.findByMerchantId.mockResolvedValue({ data: [mockNfcTag], total: 1 });
      const result = await service.findByMerchant(null, 1, 10);
      expect(result.total).toBe(1);
      expect(mockNfcRepo.findByMerchantId).toHaveBeenCalledWith(null, 1, 10);
    });
  });
});

// ─── CreateNfcTagUseCase ──────────────────────────────────────────────────────
describe('CreateNfcTagUseCase', () => {
  let useCase: CreateNfcTagUseCase;

  const mockNfcRepo = { create: jest.fn(), countByMerchant: jest.fn() };
  const mockMerchantRepo = { findById: jest.fn() };
  const mockEncryptionService = { encryptPayload: jest.fn().mockReturnValue('enc_payload') };
  const mockEventEmitter = { emit: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateNfcTagUseCase,
        { provide: 'INfcRepository', useValue: mockNfcRepo },
        { provide: 'IMerchantRepository', useValue: mockMerchantRepo },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();
    useCase = module.get<CreateNfcTagUseCase>(CreateNfcTagUseCase);
  });

  it('throws NotFoundException when merchant does not exist', async () => {
    mockMerchantRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(999, {})).rejects.toThrow(NotFoundException);
  });

  it('throws UnprocessableEntityException for inactive merchant', async () => {
    mockMerchantRepo.findById.mockResolvedValue(mockInactiveMerchant);
    await expect(useCase.execute(2, {})).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws UnprocessableEntityException when tag limit is reached', async () => {
    mockMerchantRepo.findById.mockResolvedValue(mockActiveMerchant);
    mockNfcRepo.countByMerchant.mockResolvedValue(NFC_CONSTANTS.MAX_TAGS_PER_MERCHANT);
    await expect(useCase.execute(1, {})).rejects.toThrow(UnprocessableEntityException);
  });

  it('error message mentions the maximum tag count', async () => {
    mockMerchantRepo.findById.mockResolvedValue(mockActiveMerchant);
    mockNfcRepo.countByMerchant.mockResolvedValue(NFC_CONSTANTS.MAX_TAGS_PER_MERCHANT);
    await expect(useCase.execute(1, {})).rejects.toThrow(/100/);
  });

  it('creates and returns a tag when all checks pass', async () => {
    mockMerchantRepo.findById.mockResolvedValue(mockActiveMerchant);
    mockNfcRepo.countByMerchant.mockResolvedValue(0);
    mockNfcRepo.create.mockResolvedValue({ ...mockNfcTag, encrypted_payload: 'enc_payload' });

    const result = await useCase.execute(1, { tag_uid: '04:AB:CD:EF:12:34' });

    expect(result.id).toBe(1);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(NFC_CONSTANTS.EVENTS.TAG_CREATED, expect.any(Object));
  });
});

// ─── DecodeTokenUseCase ───────────────────────────────────────────────────────
describe('DecodeTokenUseCase', () => {
  let useCase: DecodeTokenUseCase;

  const mockMerchantRepo = { findById: jest.fn() };
  const mockEncryptionService = { decryptPayload: jest.fn() };
  const mockConfigService = { get: jest.fn().mockReturnValue('https://pay.example.com') };
  const mockEventEmitter = { emit: jest.fn() };

  const validPayload = {
    mid: 1,
    uid: 2,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecodeTokenUseCase,
        { provide: 'IMerchantRepository', useValue: mockMerchantRepo },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();
    useCase = module.get<DecodeTokenUseCase>(DecodeTokenUseCase);
  });

  it('decodes a valid token and returns merchant context', async () => {
    mockEncryptionService.decryptPayload.mockReturnValue(JSON.stringify(validPayload));
    mockMerchantRepo.findById.mockResolvedValue(mockActiveMerchant);

    const result = await useCase.execute({ merchantId: 'valid_token' });

    expect(result.success).toBe(true);
    expect(result.data.merchant_id).toBe(1);
    expect(result.data.merchant_name).toBe('DemoShop');
    expect(result.data.session_uuid).toBeDefined();
  });

  it('emits PAYMENT_SESSION_STARTED event on successful decode', async () => {
    mockEncryptionService.decryptPayload.mockReturnValue(JSON.stringify(validPayload));
    mockMerchantRepo.findById.mockResolvedValue(mockActiveMerchant);

    await useCase.execute({ merchantId: 'valid_token', ipAddress: '1.2.3.4' });

    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      NFC_CONSTANTS.EVENTS.PAYMENT_SESSION_STARTED,
      expect.objectContaining({ merchantId: 1, ipAddress: '1.2.3.4' }),
    );
  });

  it('throws NotFoundException when decoded merchant_id does not exist', async () => {
    mockMerchantRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute({ merchantId: '999' })).rejects.toThrow(NotFoundException);
  });
});