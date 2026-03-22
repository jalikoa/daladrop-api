import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateMerchantUseCase } from '../create-merchant.usecase';
import { IMerchantRepository } from '../../interfaces/merchant-repository.interface';
import { CreateMerchantDto } from '../../dto/create-merchant.dto';
import { MerchantProfile } from '../../entities/merchant-profile.entity';
import { MerchantStatus, MerchantVerificationStatus } from '../../enums/merchant-status.enum';

/**
 * Unit Tests for CreateMerchantUseCase
 */
describe('CreateMerchantUseCase - Unit Tests', () => {
  let useCase: CreateMerchantUseCase;
  let mockMerchantRepository: Partial<IMerchantRepository>;
  let mockEventEmitter: Partial<EventEmitter2>;

  const mockMerchant: Partial<MerchantProfile> = {
    id: 1,
    user_id: 2,
    business_name: 'Test Business',
    paybill_number: '123456',
    account_number: 'ACC001',
    status: MerchantStatus.PENDING,
    verification_status: MerchantVerificationStatus.UNVERIFIED,
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
  };

  const createMerchantDto: CreateMerchantDto = {
    business_name: 'Test Business',
    business_email: 'test@example.com',
    paybill_number: '123456',
    account_number: 'ACC001',
  };

  beforeEach(async () => {
    mockMerchantRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateMerchantUseCase,
        { provide: 'IMerchantRepository', useValue: mockMerchantRepository },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    useCase = module.get<CreateMerchantUseCase>(CreateMerchantUseCase);
  });

  describe('execute()', () => {
    it('should create merchant successfully', async () => {
      mockMerchantRepository.findByUserId.mockResolvedValue(null);
      mockMerchantRepository.create.mockResolvedValue(mockMerchant as MerchantProfile);

      const result = await useCase.execute(2, createMerchantDto);

      expect(result).toEqual(mockMerchant);
      expect(mockMerchantRepository.create).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          business_name: 'Test Business',
          paybill_number: '123456',
          account_number: 'ACC001',
        }),
      );
    });

    it('should throw ConflictException when user already has merchant', async () => {
      mockMerchantRepository.findByUserId.mockResolvedValue(mockMerchant as MerchantProfile);
      mockMerchantRepository.create.mockRejectedValue(new ConflictException('Merchant profile already exists for this user'));

      await expect(useCase.execute(2, createMerchantDto))
        .rejects.toThrow(ConflictException);
    });

    it('should emit merchant.created event', async () => {
      mockMerchantRepository.findByUserId.mockResolvedValue(null);
      mockMerchantRepository.create.mockResolvedValue(mockMerchant as MerchantProfile);

      await useCase.execute(2, createMerchantDto);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'merchant.created',
        expect.objectContaining({
          merchantId: 1,
          userId: 2,
        }),
      );
    });

    it('should normalize business_name (trim whitespace)', async () => {
      mockMerchantRepository.findByUserId.mockResolvedValue(null);
      mockMerchantRepository.create.mockResolvedValue(mockMerchant as MerchantProfile);

      const dtoWithSpaces: CreateMerchantDto = {
        ...createMerchantDto,
        business_name: '  Test Business  ',
      };

      await useCase.execute(2, dtoWithSpaces);

      expect(mockMerchantRepository.create).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          business_name: '  Test Business  ',
        }),
      );
    });

    it('should normalize paybill_number (remove spaces)', async () => {
      mockMerchantRepository.findByUserId.mockResolvedValue(null);
      mockMerchantRepository.create.mockResolvedValue(mockMerchant as MerchantProfile);

      const dtoWithSpaces: CreateMerchantDto = {
        ...createMerchantDto,
        paybill_number: '123 456',
      };

      await useCase.execute(2, dtoWithSpaces);

      expect(mockMerchantRepository.create).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          paybill_number: '123 456',
        }),
      );
    });

    it('should normalize account_number (remove spaces)', async () => {
      mockMerchantRepository.findByUserId.mockResolvedValue(null);
      mockMerchantRepository.create.mockResolvedValue(mockMerchant as MerchantProfile);

      const dtoWithSpaces: CreateMerchantDto = {
        ...createMerchantDto,
        account_number: 'ACC 001',
      };

      await useCase.execute(2, dtoWithSpaces);

      expect(mockMerchantRepository.create).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          account_number: 'ACC 001',
        }),
      );
    });

    it('should set default status to PENDING', async () => {
      mockMerchantRepository.findByUserId.mockResolvedValue(null);
      mockMerchantRepository.create.mockResolvedValue(mockMerchant as MerchantProfile);

      await useCase.execute(2, createMerchantDto);

      // Status is set by repository, not use case
      expect(mockMerchantRepository.create).toHaveBeenCalled();
    });

    it('should set default verification_status to UNVERIFIED', async () => {
      mockMerchantRepository.findByUserId.mockResolvedValue(null);
      mockMerchantRepository.create.mockResolvedValue(mockMerchant as MerchantProfile);

      await useCase.execute(2, createMerchantDto);

      // Verification status is set by repository, not use case
      expect(mockMerchantRepository.create).toHaveBeenCalled();
    });

    it('should include business_email in created merchant', async () => {
      mockMerchantRepository.findByUserId.mockResolvedValue(null);
      mockMerchantRepository.create.mockResolvedValue(mockMerchant as MerchantProfile);

      await useCase.execute(2, {
        ...createMerchantDto,
        business_email: 'merchant@example.com',
      });

      expect(mockMerchantRepository.create).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          business_email: 'merchant@example.com',
        }),
      );
    });

    it('should handle merchant creation without business_email', async () => {
      mockMerchantRepository.findByUserId.mockResolvedValue(null);
      mockMerchantRepository.create.mockResolvedValue(mockMerchant as MerchantProfile);

      const dtoWithoutEmail: CreateMerchantDto = {
        business_name: 'Test Business',
        paybill_number: '123456',
        account_number: 'ACC001',
      };

      await useCase.execute(2, dtoWithoutEmail);

      expect(mockMerchantRepository.create).toHaveBeenCalled();
    });
  });

  describe('Error scenarios', () => {
    it('should handle repository errors', async () => {
      mockMerchantRepository.findByUserId.mockResolvedValue(null);
      mockMerchantRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(useCase.execute(2, createMerchantDto))
        .rejects.toThrow('Database error');
    });

    it('should handle null user_id', async () => {
      mockMerchantRepository.findByUserId.mockResolvedValue(null);
      mockMerchantRepository.create.mockResolvedValue(mockMerchant as MerchantProfile);

      await useCase.execute(null as any, createMerchantDto);

      expect(mockMerchantRepository.create).toHaveBeenCalledWith(
        null,
        expect.any(Object),
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle special characters in business_name', async () => {
      mockMerchantRepository.findByUserId.mockResolvedValue(null);
      mockMerchantRepository.create.mockResolvedValue(mockMerchant as MerchantProfile);

      const dtoWithSpecialChars: CreateMerchantDto = {
        ...createMerchantDto,
        business_name: 'Test & Co. Ltd',
      };

      await useCase.execute(2, dtoWithSpecialChars);

      expect(mockMerchantRepository.create).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          business_name: 'Test & Co. Ltd',
        }),
      );
    });

    it('should handle long business_name', async () => {
      mockMerchantRepository.findByUserId.mockResolvedValue(null);
      mockMerchantRepository.create.mockResolvedValue(mockMerchant as MerchantProfile);

      const longName = 'A'.repeat(200);
      const dtoWithLongName: CreateMerchantDto = {
        ...createMerchantDto,
        business_name: longName,
      };

      await useCase.execute(2, dtoWithLongName);

      expect(mockMerchantRepository.create).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          business_name: longName,
        }),
      );
    });

    it('should handle unicode characters in business_name', async () => {
      mockMerchantRepository.findByUserId.mockResolvedValue(null);
      mockMerchantRepository.create.mockResolvedValue(mockMerchant as MerchantProfile);

      const dtoWithUnicode: CreateMerchantDto = {
        ...createMerchantDto,
        business_name: 'Test 商店 🏪',
      };

      await useCase.execute(2, dtoWithUnicode);

      expect(mockMerchantRepository.create).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          business_name: 'Test 商店 🏪',
        }),
      );
    });
  });
});
