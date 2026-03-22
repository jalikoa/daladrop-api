import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { UserRepository } from '../user.repository';
import { User } from '../../entities/user.entity';
import { CreateUserDto } from '../../dto/create-user.dto';
import { UpdateUserDto } from '../../dto/update-user.dto';
import { UserRole, UserStatus } from '../../enums/user-role.enum';
import * as bcrypt from 'bcryptjs';

/**
 * Unit Tests for UserRepository
 */
describe('UserRepository - Unit Tests', () => {
  let repository: UserRepository;
  let mockRepository: Partial<Repository<User>>;
  let mockDataSource: Partial<DataSource>;

  const mockUser: User = {
    id: 1,
    uuid: '550e8400-e29b-41d4-a716-446655440000',
    email: 'user@example.com',
    phone_number: '254712345678',
    password_hash: 'hashedpassword',
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    mockRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      exists: jest.fn(),
      merge: jest.fn(),
    };

    mockDataSource = {
      transaction: jest.fn((callback) => callback(mockRepository)),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        {
          provide: 'UserRepository',
          useValue: mockRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
  });

  describe('findById()', () => {
    it('should return user by ID', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await repository.findById(1);

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should return null when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByUuid()', () => {
    it('should return user by UUID', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await repository.findByUuid('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { uuid: '550e8400-e29b-41d4-a716-446655440000' } });
    });

    it('should return null when user not found by UUID', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findByUuid('non-existent-uuid');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail()', () => {
    it('should return user by email', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await repository.findByEmail('user@example.com');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { email: 'user@example.com' } });
    });

    it('should return null when user not found by email', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByPhone()', () => {
    it('should return user by phone number', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await repository.findByPhone('254712345678');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { phone_number: '254712345678' } });
    });

    it('should return null when user not found by phone', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findByPhone('254999999999');

      expect(result).toBeNull();
    });
  });

  describe('findByIdWithPassword()', () => {
    it('should return active user with password', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await repository.findByIdWithPassword(1);

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, status: UserStatus.ACTIVE },
      });
    });

    it('should return null for inactive user', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findByIdWithPassword(1);

      expect(result).toBeNull();
    });
  });

  describe('findByEmailOrPhone()', () => {
    it('should return user by email or phone', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await repository.findByEmailOrPhone('user@example.com');

      expect(result).toEqual(mockUser);
      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('user');
    });

    it('should return null when user not found', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await repository.findByEmailOrPhone('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findAll()', () => {
    it('should return paginated users', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockUser], 1]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await repository.findAll(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0]).toEqual(mockUser);
    });

    it('should filter by role when provided', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await repository.findAll(1, 10, UserRole.ADMIN);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('user.role = :role', { role: UserRole.ADMIN });
    });

    it('should use default pagination values', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await repository.findAll();

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should order by created_at DESC', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await repository.findAll(1, 10);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('user.created_at', 'DESC');
    });
  });

  describe('create()', () => {
    const createDto: CreateUserDto = {
      email: 'newuser@example.com',
      password: 'password123',
    };

    it('should create user successfully', async () => {
      mockRepository.exists.mockResolvedValue(false);
      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      const result = await repository.create(createDto);

      expect(result).toEqual(mockUser);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newuser@example.com',
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          is_active: true,
        }),
      );
    });

    it('should hash password before saving', async () => {
      mockRepository.exists.mockResolvedValue(false);
      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      await repository.create(createDto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          password_hash: expect.any(String),
        }),
      );
    });

    it('should throw ConflictException when email exists', async () => {
      mockRepository.exists.mockResolvedValue(true);

      await expect(repository.create(createDto)).rejects.toThrow(ConflictException);
      await expect(repository.create(createDto)).rejects.toThrow('Email already registered');
    });

    it('should throw ConflictException when phone exists', async () => {
      mockRepository.exists
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await expect(repository.create({ ...createDto, phone_number: '254712345678' }))
        .rejects.toThrow(ConflictException);
    });

    it('should create user without password', async () => {
      const dtoWithoutPassword: CreateUserDto = {
        email: 'nopassword@example.com',
      };

      mockRepository.exists.mockResolvedValue(false);
      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      const result = await repository.create(dtoWithoutPassword);

      expect(result).toEqual(mockUser);
    });

    it('should set default role to CUSTOMER', async () => {
      mockRepository.exists.mockResolvedValue(false);
      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      await repository.create(createDto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.CUSTOMER,
        }),
      );
    });

    it('should use provided role', async () => {
      mockRepository.exists.mockResolvedValue(false);
      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      await repository.create({ ...createDto, role: UserRole.ADMIN });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.ADMIN,
        }),
      );
    });
  });

  describe('update()', () => {
    const updateDto: UpdateUserDto = {
      email: 'updated@example.com',
    };

    it('should update user successfully', async () => {
      mockRepository.findOne.mockResolvedValueOnce(mockUser);
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.findOne.mockResolvedValueOnce({ ...mockUser, email: 'updated@example.com' });

      const result = await repository.update(1, updateDto);

      expect(result.email).toBe('updated@example.com');
      expect(mockRepository.update).toHaveBeenCalledWith(1, expect.any(Object));
    });

    it('should throw NotFoundException when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(repository.update(999, updateDto)).rejects.toThrow(NotFoundException);
      await expect(repository.update(999, updateDto)).rejects.toThrow('User with ID 999 not found');
    });

    it('should hash new password if provided', async () => {
      mockRepository.findOne.mockResolvedValueOnce(mockUser);
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.findOne.mockResolvedValueOnce(mockUser);

      await repository.update(1, { password: 'newpassword123' });

      expect(mockRepository.update).toHaveBeenCalledWith(1, expect.objectContaining({
        password_hash: expect.any(String),
      }));
    });

    it('should remove password from data after hashing', async () => {
      mockRepository.findOne.mockResolvedValueOnce(mockUser);
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.findOne.mockResolvedValueOnce(mockUser);

      await repository.update(1, { password: 'newpassword123' });

      expect(mockRepository.update).toHaveBeenCalledWith(1, expect.not.objectContaining({ password: expect.anything() }));
    });
  });

  describe('softDelete()', () => {
    it('should soft delete user by updating status', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });

      await repository.softDelete(1);

      expect(mockRepository.update).toHaveBeenCalledWith(1, {
        status: UserStatus.DELETED,
        is_active: false,
      });
    });
  });

  describe('updateStatus()', () => {
    it('should update user status to ACTIVE', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });

      await repository.updateStatus(1, UserStatus.ACTIVE);

      expect(mockRepository.update).toHaveBeenCalledWith(1, {
        status: UserStatus.ACTIVE,
        is_active: true,
      });
    });

    it('should update user status to SUSPENDED', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });

      await repository.updateStatus(1, UserStatus.SUSPENDED);

      expect(mockRepository.update).toHaveBeenCalledWith(1, {
        status: UserStatus.SUSPENDED,
        is_active: false,
      });
    });

    it('should update user status to PENDING', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });

      await repository.updateStatus(1, UserStatus.PENDING);

      expect(mockRepository.update).toHaveBeenCalledWith(1, {
        status: UserStatus.PENDING,
        is_active: false,
      });
    });
  });

  describe('existsByEmail()', () => {
    it('should return true when email exists', async () => {
      mockRepository.exists.mockResolvedValue(true);

      const result = await repository.existsByEmail('user@example.com');

      expect(result).toBe(true);
      expect(mockRepository.exists).toHaveBeenCalledWith({ where: { email: 'user@example.com' } });
    });

    it('should return false when email does not exist', async () => {
      mockRepository.exists.mockResolvedValue(false);

      const result = await repository.existsByEmail('unknown@example.com');

      expect(result).toBe(false);
    });
  });

  describe('existsByPhone()', () => {
    it('should return true when phone exists', async () => {
      mockRepository.exists.mockResolvedValue(true);

      const result = await repository.existsByPhone('254712345678');

      expect(result).toBe(true);
      expect(mockRepository.exists).toHaveBeenCalledWith({ where: { phone_number: '254712345678' } });
    });

    it('should return false when phone does not exist', async () => {
      mockRepository.exists.mockResolvedValue(false);

      const result = await repository.existsByPhone('254999999999');

      expect(result).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle special characters in email', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      await repository.findByEmail('user+tag@example.com');

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { email: 'user+tag@example.com' } });
    });

    it('should handle international phone numbers', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      await repository.findByPhone('+254712345678');

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { phone_number: '+254712345678' } });
    });

    it('should handle large user IDs', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      await repository.findById(Number.MAX_SAFE_INTEGER);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: Number.MAX_SAFE_INTEGER } });
    });
  });
});
