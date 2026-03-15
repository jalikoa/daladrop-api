import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { UserLoggingInterceptor } from '../interceptors/user-logging.interceptor';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserOwnerGuard } from '../guards/user-owner.guard';
import { UserRole, UserStatus } from '../enums/user-role.enum';

const mockUserDto = {
  id: 2,
  uuid: 'e09e307f-7600-4dd1-b530-44696dd62d89',
  email: 'alice@example.com',
  phone_number: null,
  role: UserRole.CUSTOMER,
  status: UserStatus.ACTIVE,
  is_active: true,
  created_at: new Date('2026-01-01').toISOString() as any,
  updated_at: new Date('2026-01-01').toISOString() as any,
};

const mockUsersService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByUuid: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

// Bypass all guards in controller unit tests
const allowAll = { canActivate: () => true };

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      .overrideGuard(JwtAuthGuard).useValue(allowAll)
      .overrideGuard(RolesGuard).useValue(allowAll)
      .overrideGuard(UserOwnerGuard).useValue(allowAll)
      .overrideInterceptor(UserLoggingInterceptor)
      .useValue({ intercept: (_ctx: any, next: any) => next.handle() })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  describe('POST /users', () => {
    it('creates a user and returns DTO', async () => {
      mockUsersService.create.mockResolvedValue(mockUserDto);
      const result = await controller.create({ email: 'alice@example.com', password: 'password123' });
      expect(result.email).toBe('alice@example.com');
      expect((result as any).password_hash).toBeUndefined();
    });
  });

  describe('GET /users', () => {
    it('returns paginated list', async () => {
      mockUsersService.findAll.mockResolvedValue({ data: [mockUserDto], total: 1 });
      const result = await controller.findAll(1, 10);
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe(2);
    });

    it('uses default page=1 and limit=10', async () => {
      mockUsersService.findAll.mockResolvedValue({ data: [], total: 0 });
      await controller.findAll(undefined as any, undefined as any);
      expect(mockUsersService.findAll).toHaveBeenCalledWith(1, 10);
    });
  });

  describe('GET /users/:id', () => {
    it('returns user by numeric ID', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUserDto);
      const result = await controller.findOne(2);
      expect(result.id).toBe(2);
    });

    it('propagates NotFoundException', async () => {
      mockUsersService.findOne.mockRejectedValue(new NotFoundException('User not found'));
      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /users/uuid/:uuid', () => {
    it('returns user by UUID', async () => {
      mockUsersService.findByUuid.mockResolvedValue(mockUserDto);
      const result = await controller.findByUuid('e09e307f-7600-4dd1-b530-44696dd62d89');
      expect(result.uuid).toBe('e09e307f-7600-4dd1-b530-44696dd62d89');
    });
  });

  describe('PATCH /users/:id', () => {
    it('returns updated DTO', async () => {
      const updated = { ...mockUserDto, phone_number: '+254799000001' };
      mockUsersService.update.mockResolvedValue(updated);
      const result = await controller.update(2, { phone_number: '+254799000001' });
      expect(result.phone_number).toBe('+254799000001');
    });
  });

  describe('DELETE /users/:id', () => {
    it('calls service.remove and returns void', async () => {
      mockUsersService.remove.mockResolvedValue(undefined);
      await expect(controller.remove(2)).resolves.toBeUndefined();
      expect(mockUsersService.remove).toHaveBeenCalledWith(2);
    });
  });
});