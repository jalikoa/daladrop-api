import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { NfcController } from '../nfc.controller';
import { NfcService } from '../nfc.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { MerchantOwnerGuard } from '../../merchants/guards/merchant-owner.guard';

const allowAll = { canActivate: () => true };

const mockNfcTagDto = {
  id: 1, merchant_id: 1, tag_uid: '04:AB:CD:EF:12:34',
  encrypted_payload: 'enc_data', is_active: true,
  description: 'Counter tag', created_at: new Date(),
};

const mockDecodedResponse = {
  success: true,
  data: {
    merchant_id: 1, merchant_name: 'DemoShop', merchant_logo: null,
    session_uuid: 'sess-uuid-123', expires_at: new Date().toISOString(),
  },
};

const mockNfcService = {
  createTag: jest.fn(),
  findOne: jest.fn(),
  findByMerchant: jest.fn(),
  decodeToken: jest.fn(),
};

describe('NfcController', () => {
  let controller: NfcController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NfcController],
      providers: [{ provide: NfcService, useValue: mockNfcService }],
    })
      .overrideGuard(JwtAuthGuard).useValue(allowAll)
      .overrideGuard(RolesGuard).useValue(allowAll)
      .overrideGuard(MerchantOwnerGuard).useValue(allowAll)
      .compile();
    controller = module.get<NfcController>(NfcController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  describe('POST /nfc', () => {
    it('creates tag and returns DTO', async () => {
      mockNfcService.createTag.mockResolvedValue(mockNfcTagDto);
      const result = await controller.createTag({ tag_uid: '04:AB:CD:EF:12:34' } as any, 1);
      expect(result.tag_uid).toBe('04:AB:CD:EF:12:34');
      expect(mockNfcService.createTag).toHaveBeenCalledWith(1, expect.any(Object));
    });

    it('propagates UnprocessableEntityException for inactive merchant', async () => {
      mockNfcService.createTag.mockRejectedValue(
        new UnprocessableEntityException('merchant is not active'),
      );
      await expect(controller.createTag({} as any, 2)).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('GET /nfc', () => {
    it('returns paginated tag list with merchant_id', async () => {
      mockNfcService.findByMerchant.mockResolvedValue({ data: [mockNfcTagDto], total: 1 });
      const result = await controller.findByMerchant(1, 1, 10);
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe(1);
    });

    it('returns all tags when merchant_id is null', async () => {
      mockNfcService.findByMerchant.mockResolvedValue({ data: [mockNfcTagDto], total: 1 });
      const result = await controller.findByMerchant(null, 1, 10);
      expect(result.total).toBe(1);
      expect(mockNfcService.findByMerchant).toHaveBeenCalledWith(null, 1, 10);
    });
  });

  describe('GET /nfc/decode', () => {
    it('decodes a valid token and returns merchant context', async () => {
      mockNfcService.decodeToken.mockResolvedValue(mockDecodedResponse);
      const mockReq = { ip: '1.2.3.4', get: () => 'Mozilla/5.0' } as any;
      const result = await controller.decodeToken({ token: 'valid_token' } as any, mockReq);
      expect(result.success).toBe(true);
      expect(result.data.merchant_id).toBe(1);
    });

    it('propagates BadRequestException for corrupt token', async () => {
      mockNfcService.decodeToken.mockRejectedValue(
        new BadRequestException('Invalid or corrupted payment token'),
      );
      const mockReq = { ip: '1.2.3.4', get: () => '' } as any;
      await expect(
        controller.decodeToken({ token: 'bad_token' } as any, mockReq),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /nfc/:id', () => {
    it('returns tag by ID', async () => {
      mockNfcService.findOne.mockResolvedValue(mockNfcTagDto);
      const result = await controller.findOne(1);
      expect(result.id).toBe(1);
    });

    it('propagates NotFoundException', async () => {
      mockNfcService.findOne.mockRejectedValue(new NotFoundException('NFC tag with ID 99 not found'));
      await expect(controller.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });
});