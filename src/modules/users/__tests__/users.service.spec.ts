import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { CreateUserUseCase } from '../use-cases/create-user.usecase';
import { FindUserUseCase } from '../use-cases/find-user.usecase';
import { UpdateUserUseCase } from '../use-cases/update-user.usecase';
import { UserRole, UserStatus } from '../enums/user-role.enum';

const mockUserEntity = {
  id: 2,
  uuid: 'e09e307f-7600-4dd1-b530-44696dd62d89',
  email: 'alice@example.com',
  phone_number: null,
  role: UserRole.CUSTOMER,
  status: UserStatus.ACTIVE,
  is_active: true,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  toJSON: () => mockUserEntity,
};

const mockUserRepo = {
  findByEmailOrPhone: jest.fn(),
  softDelete: jest.fn(),
  findAll: jest.fn(),
};

const mockCreateUseCase = { execute: jest.fn() };
const mockFindUseCase = { byId: jest.fn(), byUuid: jest.fn() };
const mockUpdateUseCase = { execute: jest.fn() };

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: CreateUserUseCase, useValue: mockCreateUseCase },
        { provide: FindUserUseCase, useValue: mockFindUseCase },
        { provide: UpdateUserUseCase, useValue: mockUpdateUseCase },
        { provide: 'IUserRepository', useValue: mockUserRepo },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('create()', () => {
    it('creates a user and returns a DTO', async () => {
      mockCreateUseCase.execute.mockResolvedValue(mockUserEntity);
      const result = await service.create({ email: 'alice@example.com', password: 'password123' });
      expect(result.email).toBe('alice@example.com');
      expect(result.id).toBe(2);
      expect((result as any).password_hash).toBeUndefined();
    });

    it('propagates errors from the use case', async () => {
      mockCreateUseCase.execute.mockRejectedValue(new Error('Email already taken'));
      await expect(service.create({ email: 'alice@example.com' })).rejects.toThrow('Email already taken');
    });
  });

  describe('findOne()', () => {
    it('returns a user DTO for a valid ID', async () => {
      mockFindUseCase.byId.mockResolvedValue(mockUserEntity);
      const result = await service.findOne(2);
      expect(result.id).toBe(2);
      expect(result.uuid).toBe('e09e307f-7600-4dd1-b530-44696dd62d89');
    });

    it('propagates NotFoundException from use case', async () => {
      mockFindUseCase.byId.mockRejectedValue(new NotFoundException('User not found'));
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUuid()', () => {
    it('returns a user DTO for a valid UUID', async () => {
      mockFindUseCase.byUuid.mockResolvedValue(mockUserEntity);
      const result = await service.findByUuid('e09e307f-7600-4dd1-b530-44696dd62d89');
      expect(result.uuid).toBe('e09e307f-7600-4dd1-b530-44696dd62d89');
    });
  });

  describe('findAll()', () => {
    it('returns paginated user list', async () => {
      mockUserRepo.findAll.mockResolvedValue({ data: [mockUserEntity], total: 1 });
      const result = await service.findAll(1, 10);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('returns empty list when no users', async () => {
      mockUserRepo.findAll.mockResolvedValue({ data: [], total: 0 });
      const result = await service.findAll(1, 10);
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('update()', () => {
    it('returns updated user DTO', async () => {
      const updated = { ...mockUserEntity, phone_number: '+254799000001' };
      mockUpdateUseCase.execute.mockResolvedValue(updated);
      const result = await service.update(2, { phone_number: '+254799000001' });
      expect(result.phone_number).toBe('+254799000001');
    });
  });

  describe('remove()', () => {
    it('calls softDelete on the repository', async () => {
      mockUserRepo.softDelete.mockResolvedValue(undefined);
      await service.remove(2);
      expect(mockUserRepo.softDelete).toHaveBeenCalledWith(2);
    });
  });

  describe('findUserWithPassword()', () => {
    it('returns entity including password_hash for auth', async () => {
      const userWithHash = { ...mockUserEntity, password_hash: '$2b$10$hash' };
      mockUserRepo.findByEmailOrPhone.mockResolvedValue(userWithHash);
      const result = await service.findUserWithPassword('alice@example.com');
      expect(result?.password_hash).toBe('$2b$10$hash');
    });

    it('returns null when no user matches identifier', async () => {
      mockUserRepo.findByEmailOrPhone.mockResolvedValue(null);
      const result = await service.findUserWithPassword('nobody@example.com');
      expect(result).toBeNull();
    });
  });
});