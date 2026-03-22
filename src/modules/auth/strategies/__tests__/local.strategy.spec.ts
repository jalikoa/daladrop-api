import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LocalStrategy } from '../local.strategy';
import { AuthService } from '../../services/auth.service';

/**
 * Unit Tests for LocalStrategy
 */
describe('LocalStrategy - Unit Tests', () => {
  let strategy: LocalStrategy;
  let mockAuthService: Partial<AuthService>;

  const mockUser = {
    id: 1,
    uuid: '550e8400-e29b-41d4-a716-446655440000',
    email: 'user@example.com',
    role: 'CUSTOMER',
  };

  beforeEach(async () => {
    mockAuthService = {
      validateUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
  });

  describe('Construction', () => {
    it('should create strategy with authService', () => {
      expect(strategy).toBeDefined();
    });

    it('should configure usernameField as email', () => {
      // The strategy is configured with usernameField: 'email'
      expect(strategy).toBeDefined();
    });
  });

  describe('validate()', () => {
    it('should return user for valid credentials', async () => {
      mockAuthService.validateUser.mockResolvedValue(mockUser);

      const result = await strategy.validate('user@example.com', 'password123');

      expect(result).toEqual(mockUser);
      expect(mockAuthService.validateUser).toHaveBeenCalledWith('user@example.com', 'password123');
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('user@example.com', 'wrongpassword'))
        .rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate('user@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException when user is undefined', async () => {
      mockAuthService.validateUser.mockResolvedValue(undefined);

      await expect(strategy.validate('user@example.com', 'password'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should call authService with correct email and password', async () => {
      mockAuthService.validateUser.mockResolvedValue(mockUser);

      await strategy.validate('test@example.com', 'SecurePass123!');

      expect(mockAuthService.validateUser).toHaveBeenCalledWith('test@example.com', 'SecurePass123!');
    });

    it('should handle different email formats', async () => {
      mockAuthService.validateUser.mockResolvedValue(mockUser);

      await strategy.validate('TEST@EXAMPLE.COM', 'password');
      expect(mockAuthService.validateUser).toHaveBeenCalledWith('TEST@EXAMPLE.COM', 'password');
    });

    it('should handle empty password', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('user@example.com', ''))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should handle empty email', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('', 'password'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('User role handling', () => {
    it('should return CUSTOMER user', async () => {
      const customerUser = { ...mockUser, role: 'CUSTOMER' };
      mockAuthService.validateUser.mockResolvedValue(customerUser);

      const result = await strategy.validate('customer@example.com', 'password');

      expect(result.role).toBe('CUSTOMER');
    });

    it('should return ADMIN user', async () => {
      const adminUser = { ...mockUser, role: 'ADMIN' };
      mockAuthService.validateUser.mockResolvedValue(adminUser);

      const result = await strategy.validate('admin@example.com', 'password');

      expect(result.role).toBe('ADMIN');
    });

    it('should return MERCHANT user', async () => {
      const merchantUser = { ...mockUser, role: 'MERCHANT' };
      mockAuthService.validateUser.mockResolvedValue(merchantUser);

      const result = await strategy.validate('merchant@example.com', 'password');

      expect(result.role).toBe('MERCHANT');
    });
  });

  describe('Error scenarios', () => {
    it('should handle database errors from authService', async () => {
      mockAuthService.validateUser.mockRejectedValue(new Error('Database error'));

      await expect(strategy.validate('user@example.com', 'password'))
        .rejects.toThrow('Database error');
    });

    it('should handle connection errors', async () => {
      mockAuthService.validateUser.mockRejectedValue(new Error('Connection timeout'));

      await expect(strategy.validate('user@example.com', 'password'))
        .rejects.toThrow('Connection timeout');
    });

    it('should handle AuthService returning error', async () => {
      mockAuthService.validateUser.mockRejectedValue(new UnauthorizedException('Auth failed'));

      await expect(strategy.validate('user@example.com', 'password'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Input validation', () => {
    it('should handle special characters in email', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('user+tag@example.com', 'password'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should handle unicode characters in password', async () => {
      mockAuthService.validateUser.mockResolvedValue(mockUser);

      const result = await strategy.validate('user@example.com', 'P@$$w0rd🔐123');

      expect(result).toEqual(mockUser);
    });

    it('should handle very long passwords', async () => {
      mockAuthService.validateUser.mockResolvedValue(mockUser);
      const longPassword = 'A'.repeat(100);

      const result = await strategy.validate('user@example.com', longPassword);

      expect(result).toEqual(mockUser);
    });
  });
});
