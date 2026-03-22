import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy, JwtPayload } from '../jwt.strategy';
import { UsersService } from '../../../users/users.service';

/**
 * Unit Tests for JwtStrategy
 */
describe('JwtStrategy - Unit Tests', () => {
  let strategy: JwtStrategy;
  let mockConfigService: Partial<ConfigService>;
  let mockUsersService: Partial<UsersService>;

  const mockUser = {
    id: 1,
    uuid: '550e8400-e29b-41d4-a716-446655440000',
    email: 'user@example.com',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    is_active: true,
  };

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockReturnValue('test-jwt-secret-key-32-chars!'),
    };

    mockUsersService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('Construction', () => {
    it('should create strategy with config secret', () => {
      expect(strategy).toBeDefined();
      expect(mockConfigService.get).toHaveBeenCalledWith('JWT_SECRET');
    });

    it('should use fallback secret when JWT_SECRET is undefined', async () => {
      mockConfigService.get = jest.fn().mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JwtStrategy,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: UsersService, useValue: mockUsersService },
        ],
      }).compile();

      const testStrategy = module.get<JwtStrategy>(JwtStrategy);
      expect(testStrategy).toBeDefined();
    });
  });

  describe('validate()', () => {
    const validPayload: JwtPayload = {
      sub: 1,
      email: 'user@example.com',
      role: 'CUSTOMER',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it('should return user data for valid token', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await strategy.validate(validPayload);

      expect(result).toEqual({
        id: mockUser.id,
        uuid: mockUser.uuid,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(mockUsersService.findOne).toHaveBeenCalledWith(validPayload.sub);
    });

    it('should return user data for ADMIN role', async () => {
      const adminPayload: JwtPayload = {
        ...validPayload,
        role: 'ADMIN',
      };
      const adminUser = { ...mockUser, role: 'ADMIN' };
      mockUsersService.findOne.mockResolvedValue(adminUser);

      const result = await strategy.validate(adminPayload);

      expect(result.role).toBe('ADMIN');
    });

    it('should return user data for MERCHANT role', async () => {
      const merchantPayload: JwtPayload = {
        ...validPayload,
        role: 'MERCHANT',
      };
      const merchantUser = { ...mockUser, role: 'MERCHANT' };
      mockUsersService.findOne.mockResolvedValue(merchantUser);

      const result = await strategy.validate(merchantPayload);

      expect(result.role).toBe('MERCHANT');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUsersService.findOne.mockResolvedValue(null);

      await expect(strategy.validate(validPayload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(validPayload)).rejects.toThrow('User not found');
    });

    it('should throw UnauthorizedException when user is undefined', async () => {
      mockUsersService.findOne.mockResolvedValue(undefined);

      await expect(strategy.validate(validPayload)).rejects.toThrow(UnauthorizedException);
    });

    it('should call usersService with correct user ID', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      await strategy.validate(validPayload);

      expect(mockUsersService.findOne).toHaveBeenCalledWith(1);
    });

    it('should handle different user IDs', async () => {
      const payload: JwtPayload = {
        ...validPayload,
        sub: 999,
      };
      mockUsersService.findOne.mockResolvedValue({ ...mockUser, id: 999 });

      await strategy.validate(payload);

      expect(mockUsersService.findOne).toHaveBeenCalledWith(999);
    });
  });

  describe('JWT Payload handling', () => {
    it('should handle payload with additional fields', async () => {
      const payloadWithExtra = {
        sub: 1,
        email: 'user@example.com',
        role: 'CUSTOMER',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        extra: 'field',
      } as any;

      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await strategy.validate(payloadWithExtra);

      expect(result).toBeDefined();
    });

    it('should handle payload with numeric role', async () => {
      const payload: any = {
        sub: 1,
        email: 'user@example.com',
        role: 1,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toBeDefined();
    });
  });

  describe('Error scenarios', () => {
    it('should handle database errors from usersService', async () => {
      mockUsersService.findOne.mockRejectedValue(new Error('Database error'));

      const payload: JwtPayload = {
        sub: 1,
        email: 'user@example.com',
        role: 'CUSTOMER',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      await expect(strategy.validate(payload)).rejects.toThrow('Database error');
    });

    it('should handle timeout errors', async () => {
      mockUsersService.findOne.mockRejectedValue(new Error('Connection timeout'));

      const payload: JwtPayload = {
        sub: 1,
        email: 'user@example.com',
        role: 'CUSTOMER',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      await expect(strategy.validate(payload)).rejects.toThrow('Connection timeout');
    });
  });

  describe('User data transformation', () => {
    it('should exclude password from returned data', async () => {
      const userWithPassword = {
        ...mockUser,
        password_hash: 'hashed_password',
        password: 'plain_password',
      };
      mockUsersService.findOne.mockResolvedValue(userWithPassword);

      const payload: JwtPayload = {
        sub: 1,
        email: 'user@example.com',
        role: 'CUSTOMER',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = await strategy.validate(payload);

      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('password_hash');
    });

    it('should include only required fields in returned data', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const payload: JwtPayload = {
        sub: 1,
        email: 'user@example.com',
        role: 'CUSTOMER',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = await strategy.validate(payload);

      expect(Object.keys(result)).toEqual(['id', 'uuid', 'email', 'role']);
    });
  });
});
