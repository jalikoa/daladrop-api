import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GeneratePaymentLinkUseCase } from '../generate-payment-link.usecase';
import { IMerchantRepository } from '../../interfaces/merchant-repository.interface';
import { EncryptionService } from '../../../../common/security/encryption.service';
import { QrService } from '../../../qr/services/qr.service';
import { ConfigService } from '@nestjs/config';
import { MerchantProfile } from '../../entities/merchant-profile.entity';
import { MerchantStatus, MerchantVerificationStatus } from '../../enums/merchant-status.enum';

/**
 * Unit Tests for GeneratePaymentLinkUseCase
 */
describe('GeneratePaymentLinkUseCase - Unit Tests', () => {
  let useCase: GeneratePaymentLinkUseCase;
  let mockMerchantRepository: Partial<IMerchantRepository>;
  let mockEncryptionService: Partial<EncryptionService>;
  let mockQrService: Partial<QrService>;
  let mockConfigService: Partial<ConfigService>;
  let mockEventEmitter: Partial<EventEmitter2>;

  const mockMerchant: Partial<MerchantProfile> = {
    id: 1,
    user_id: 2,
    business_name: 'Test Business',
    paybill_number: '123456',
    account_number: 'ACC001',
    status: MerchantStatus.ACTIVE,
    verification_status: MerchantVerificationStatus.VERIFIED,
    isActive: () => true,
  };

  const pendingMerchant: Partial<MerchantProfile> = {
    ...mockMerchant,
    status: MerchantStatus.PENDING,
    verification_status: MerchantVerificationStatus.UNVERIFIED,
    isActive: () => false,
  };

  beforeEach(async () => {
    mockMerchantRepository = {
      findById: jest.fn(),
    };

    mockEncryptionService = {
      encryptPayload: jest.fn().mockReturnValue('encrypted-token'),
    };

    mockQrService = {
      generate: jest.fn().mockResolvedValue('data:image/png;base64,qrcode'),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('https://pay.example.com'),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneratePaymentLinkUseCase,
        { provide: 'IMerchantRepository', useValue: mockMerchantRepository },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: QrService, useValue: mockQrService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    useCase = module.get<GeneratePaymentLinkUseCase>(GeneratePaymentLinkUseCase);
  });

  describe('execute()', () => {
    it('should generate payment link successfully', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);

      const result = await useCase.execute({ merchantId: 1 });

      expect(result.merchant_id).toBe(1);
      expect(result.merchant_name).toBe('Test Business');
      expect(result.encrypted_token).toBe('encrypted-token');
      expect(result.payment_url).toContain('https://pay.example.com');
    });

    it('should throw NotFoundException when merchant not found', async () => {
      mockMerchantRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute({ merchantId: 999 }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw UnprocessableEntityException when merchant is not active', async () => {
      mockMerchantRepository.findById.mockResolvedValue(pendingMerchant);

      await expect(useCase.execute({ merchantId: 1 }))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('should generate encrypted token with merchant data', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);

      await useCase.execute({ merchantId: 1 });

      expect(mockEncryptionService.encryptPayload).toHaveBeenCalledWith(
        expect.any(String),
      );
    });

    it('should include merchant ID in token payload', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);

      await useCase.execute({ merchantId: 1 });

      const payload = JSON.parse(
        (mockEncryptionService.encryptPayload as jest.Mock).mock.calls[0][0]
      );
      expect(payload.mid).toBe(1);
    });

    it('should include user ID in token payload', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);

      await useCase.execute({ merchantId: 1 });

      const payload = JSON.parse(
        (mockEncryptionService.encryptPayload as jest.Mock).mock.calls[0][0]
      );
      expect(payload.uid).toBe(2);
    });

    it('should include issuedAt timestamp in token payload', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);

      await useCase.execute({ merchantId: 1 });

      const payload = JSON.parse(
        (mockEncryptionService.encryptPayload as jest.Mock).mock.calls[0][0]
      );
      expect(payload.issuedAt).toBeDefined();
      expect(new Date(payload.issuedAt)).toBeInstanceOf(Date);
    });

    it('should include expiresAt timestamp in token payload', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);

      await useCase.execute({ merchantId: 1 });

      const payload = JSON.parse(
        (mockEncryptionService.encryptPayload as jest.Mock).mock.calls[0][0]
      );
      expect(payload.expiresAt).toBeDefined();
      expect(new Date(payload.expiresAt)).toBeInstanceOf(Date);
    });

    it('should generate QR code by default', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);

      await useCase.execute({ merchantId: 1 });

      expect(mockQrService.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(String),
        }),
      );
    });

    it('should skip QR code generation when includeQr is false', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);

      await useCase.execute({ merchantId: 1, includeQr: false });

      expect(mockQrService.generate).not.toHaveBeenCalled();
    });

    it('should use PUBLIC_URL from config', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);

      await useCase.execute({ merchantId: 1 });

      expect(mockConfigService.get).toHaveBeenCalledWith('PUBLIC_URL');
    });

    it('should use default URL when PUBLIC_URL not configured', async () => {
      mockConfigService.get = jest.fn().mockReturnValue(undefined);
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);

      await useCase.execute({ merchantId: 1 });

      expect(mockConfigService.get).toHaveBeenCalledWith('PUBLIC_URL');
    });

    it('should emit QR_GENERATED event when QR is generated', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);

      await useCase.execute({ merchantId: 1 });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        expect.stringContaining('qr.generated'),
        expect.any(Object),
      );
    });

    it('should emit PAYMENT_LINK_GENERATED event', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);

      await useCase.execute({ merchantId: 1 });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        expect.stringContaining('merchant.payment-link.generated'),
        expect.any(Object),
      );
    });

    it('should include QR code data URL in response', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);

      const result = await useCase.execute({ merchantId: 1 });

      expect(result.qr_code_data_url).toBe('data:image/png;base64,qrcode');
    });

    it('should return empty QR code when includeQr is false', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);

      const result = await useCase.execute({ merchantId: 1, includeQr: false });

      expect(result.qr_code_data_url).toBe('');
    });

    it('should include expires_at in response', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);

      const result = await useCase.execute({ merchantId: 1 });

      expect(result.expires_at).toBeInstanceOf(Date);
    });

    it('should include created_at in response', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);

      const result = await useCase.execute({ merchantId: 1 });

      expect(result.created_at).toBeInstanceOf(Date);
    });
  });

  describe('Error scenarios', () => {
    it('should handle repository errors', async () => {
      mockMerchantRepository.findById.mockRejectedValue(new Error('Database error'));

      await expect(useCase.execute({ merchantId: 1 }))
        .rejects.toThrow('Database error');
    });

    it('should handle encryption errors', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);
      (mockEncryptionService.encryptPayload as jest.Mock).mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      await expect(useCase.execute({ merchantId: 1 }))
        .rejects.toThrow('Encryption failed');
    });

    it('should handle QR generation errors', async () => {
      mockMerchantRepository.findById.mockResolvedValue(mockMerchant);
      (mockQrService.generate as jest.Mock).mockRejectedValue(new Error('QR generation failed'));

      await expect(useCase.execute({ merchantId: 1 }))
        .rejects.toThrow('QR generation failed');
    });
  });

  describe('Edge cases', () => {
    it('should handle merchant with null business_email', async () => {
      const merchantWithoutEmail = { ...mockMerchant, business_email: null };
      mockMerchantRepository.findById.mockResolvedValue(merchantWithoutEmail);

      const result = await useCase.execute({ merchantId: 1 });

      expect(result.merchant_name).toBe('Test Business');
    });

    it('should handle merchant with special characters in name', async () => {
      const merchantWithSpecialChars = {
        ...mockMerchant,
        business_name: 'Test & Co. Ltd',
      };
      mockMerchantRepository.findById.mockResolvedValue(merchantWithSpecialChars);

      const result = await useCase.execute({ merchantId: 1 });

      expect(result.merchant_name).toBe('Test & Co. Ltd');
    });

    it('should handle suspended merchant', async () => {
      const suspendedMerchant = {
        ...mockMerchant,
        status: MerchantStatus.SUSPENDED,
        isActive: () => false,
      };
      mockMerchantRepository.findById.mockResolvedValue(suspendedMerchant);

      await expect(useCase.execute({ merchantId: 1 }))
        .rejects.toThrow(UnprocessableEntityException);
    });
  });
});
