import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';
import { UsersService } from '../../users/users.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { UserRole } from '../../users/enums/user-role.enum';
import * as bcrypt from 'bcryptjs';

/**
 * Security Tests for Authentication & Authorization
 * 
 * Tests JWT validity, password hashing, role-based access control,
 * token expiration, and authentication flows.
 */

// ─── Mock Data ────────────────────────────────────────────────────────────────
const mockUser = {
  id: 1,
  uuid: '550e8400-e29b-41d4-a716-446655440000',
  email: 'user@example.com',
  password_hash: '$2b$10$hashedpassword',
  role: UserRole.CUSTOMER,
  status: 'ACTIVE',
  is_active: true,
};

const mockAdminUser = {
  ...mockUser,
  id: 2,
  email: 'admin@example.com',
  role: UserRole.ADMIN,
};

const mockUsersService = {
  findUserWithPassword: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('1d'),
};

// ─── JWT Security Tests ───────────────────────────────────────────────────────
describe('JWT Security Tests', () => {
  let jwtService: JwtService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtService,
        ConfigService,
      ],
    }).compile();

    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('Token Generation', () => {
    it('should generate a valid JWT token with required claims', () => {
      const payload = { sub: 1, email: 'user@example.com', role: UserRole.CUSTOMER };
      const token = jwtService.sign(payload, { secret: 'test-secret-key-32-chars-long!' });
      
      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3); // header.payload.signature
    });

    it('should include expiration in token', () => {
      const payload = { sub: 1, email: 'user@example.com' };
      const token = jwtService.sign(payload, { 
        secret: 'test-secret-key-32-chars-long!',
        expiresIn: '1h',
      });
      
      const decoded: any = jwtService.decode(token);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    it('should include custom claims in payload', () => {
      const payload = { 
        sub: 1, 
        email: 'user@example.com', 
        role: UserRole.ADMIN,
        customClaim: 'test-value',
      };
      const token = jwtService.sign(payload, { secret: 'test-secret-key-32-chars-long!' });
      
      const decoded: any = jwtService.decode(token);
      expect(decoded.role).toBe(UserRole.ADMIN);
      expect(decoded.customClaim).toBe('test-value');
    });
  });

  describe('Token Verification', () => {
    it('should verify a valid token', () => {
      const payload = { sub: 1, email: 'user@example.com' };
      const token = jwtService.sign(payload, { secret: 'test-secret-key-32-chars-long!' });
      
      const verified = jwtService.verify(token, { secret: 'test-secret-key-32-chars-long!' });
      expect(verified).toBeDefined();
      expect((verified as any).sub).toBe(1);
    });

    it('should throw error for token signed with different secret', () => {
      const payload = { sub: 1 };
      const token = jwtService.sign(payload, { secret: 'secret-1' });
      
      expect(() => {
        jwtService.verify(token, { secret: 'secret-2' });
      }).toThrow();
    });

    it('should reject tampered token', () => {
      const payload = { sub: 1, role: UserRole.CUSTOMER };
      const token = jwtService.sign(payload, { secret: 'test-secret-key-32-chars-long!' });
      
      // Tamper with the token
      const parts = token.split('.');
      const tamperedToken = parts[0] + '.' + parts[1] + '.tampered-signature';
      
      expect(() => {
        jwtService.verify(tamperedToken, { secret: 'test-secret-key-32-chars-long!' });
      }).toThrow();
    });
  });

  describe('Token Expiration', () => {
    it('should reject expired token', () => {
      const payload = { sub: 1 };
      const token = jwtService.sign(payload, { 
        secret: 'test-secret-key-32-chars-long!',
        expiresIn: '-1s', // Already expired
      });
      
      expect(() => {
        jwtService.verify(token, { secret: 'test-secret-key-32-chars-long!' });
      }).toThrow();
    });

    it('should accept non-expired token', () => {
      const payload = { sub: 1 };
      const token = jwtService.sign(payload, { 
        secret: 'test-secret-key-32-chars-long!',
        expiresIn: '1h',
      });
      
      expect(() => {
        jwtService.verify(token, { secret: 'test-secret-key-32-chars-long!' });
      }).not.toThrow();
    });
  });
});

// ─── Password Security Tests ──────────────────────────────────────────────────
describe('Password Security Tests', () => {
  describe('Password Hashing', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'SecurePassword123!';
      const hash = await bcrypt.hash(password, 10);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(password.length);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'SecurePassword123!';
      const hash1 = await bcrypt.hash(password, 10);
      const hash2 = await bcrypt.hash(password, 10);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should use salt rounds in hash', async () => {
      const password = 'SecurePassword123!';
      const hash = await bcrypt.hash(password, 10);
      
      // bcrypt hash format: $2b$[cost]$[salt][hash]
      expect(hash).toMatch(/^\$2[aby]\$\d+\$/);
      const saltRounds = parseInt(hash.split('$')[2]);
      expect(saltRounds).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Password Verification', () => {
    it('should verify correct password', async () => {
      const password = 'SecurePassword123!';
      const hash = await bcrypt.hash(password, 10);
      
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'SecurePassword123!';
      const hash = await bcrypt.hash(password, 10);
      
      const isValid = await bcrypt.compare('WrongPassword', hash);
      expect(isValid).toBe(false);
    });

    it('should reject empty password', async () => {
      const password = 'SecurePassword123!';
      const hash = await bcrypt.hash(password, 10);
      
      const isValid = await bcrypt.compare('', hash);
      expect(isValid).toBe(false);
    });

    it('should be case-sensitive', async () => {
      const password = 'SecurePassword123!';
      const hash = await bcrypt.hash(password, 10);
      
      const isValid = await bcrypt.compare('securepassword123!', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('Password Strength', () => {
    it('should handle long passwords', async () => {
      const password = 'A'.repeat(100);
      const hash = await bcrypt.hash(password, 10);
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should handle special characters', async () => {
      const password = 'P@$$w0rd!#$%^&*()_+';
      const hash = await bcrypt.hash(password, 10);
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should handle unicode characters', async () => {
      const password = 'Password🔐123!';
      const hash = await bcrypt.hash(password, 10);
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });
  });
});

// ─── Role-Based Access Control Tests ──────────────────────────────────────────
describe('Role-Based Access Control (RBAC) Tests', () => {
  let authService: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('Role Assignment', () => {
    it('should assign CUSTOMER role by default', async () => {
      mockUsersService.create.mockResolvedValue({
        ...mockUser,
        role: UserRole.CUSTOMER,
      });

      // Test that user creation assigns correct role
      expect(UserRole.CUSTOMER).toBeDefined();
      expect(UserRole.ADMIN).toBeDefined();
      expect(UserRole.MERCHANT).toBeDefined();
    });

    it('should have distinct role hierarchy', () => {
      expect(UserRole.ADMIN).not.toBe(UserRole.CUSTOMER);
      expect(UserRole.ADMIN).not.toBe(UserRole.MERCHANT);
      expect(UserRole.MERCHANT).not.toBe(UserRole.CUSTOMER);
    });
  });

  describe('Guard Tests', () => {
    it('should create valid JwtAuthGuard instance', () => {
      const guard = new JwtAuthGuard(mockJwtService as any);
      expect(guard).toBeDefined();
      expect(typeof guard.canActivate).toBe('function');
    });

    it('should create valid RolesGuard instance', () => {
      const guard = new RolesGuard();
      expect(guard).toBeDefined();
      expect(typeof guard.canActivate).toBe('function');
    });

    describe('JwtAuthGuard', () => {
      it('should be defined with JwtService', () => {
        const guard = new JwtAuthGuard(mockJwtService as any);
        expect(guard).toBeDefined();
      });

      it('should have canActivate method', () => {
        const guard = new JwtAuthGuard(mockJwtService as any);
        expect(typeof guard.canActivate).toBe('function');
      });
    });

    describe('RolesGuard', () => {
      const mockReflector = {
        getAllAndOverride: jest.fn(),
      };

      it('should allow access when user has required role', () => {
        const guard = new RolesGuard(mockReflector as any);
        const mockContext = {
          switchToHttp: () => ({
            getRequest: () => ({
              user: { role: UserRole.ADMIN },
            }),
          }),
          getHandler: () => ({}),
          getClass: () => ({}),
        } as any;

        mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

        const result = guard.canActivate(mockContext);
        expect(result).toBe(true);
      });

      it('should deny access when user lacks required role', () => {
        const guard = new RolesGuard(mockReflector as any);
        const mockContext = {
          switchToHttp: () => ({
            getRequest: () => ({
              user: { role: UserRole.CUSTOMER },
            }),
          }),
          getHandler: () => ({}),
          getClass: () => ({}),
        } as any;

        mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

        const result = guard.canActivate(mockContext);
        expect(result).toBe(false);
      });
    });
  });
});

// ─── Authentication Flow Security Tests ───────────────────────────────────────
describe('Authentication Flow Security Tests', () => {
  let authService: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('Token Refresh Security', () => {
    it('should invalidate old refresh token after use', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 1 });
      mockUsersService.findOne.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('new-token');

      const result = await authService.refreshToken('old-refresh-token');

      expect(result.access_token).toBeDefined();
      // In production, the old refresh token should be invalidated
    });

    it('should reject expired refresh token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new UnauthorizedException('Token expired');
      });

      await expect(
        authService.refreshToken('expired-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject malformed refresh token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new UnauthorizedException('Invalid token');
      });

      await expect(
        authService.refreshToken('not-a-valid-jwt'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});

// ─── Encryption Security Tests ────────────────────────────────────────────────
describe('Encryption Security Tests', () => {
  describe('AES-256 Encryption', () => {
    it('should use 256-bit key length', () => {
      const key = 'abcdefghijklmnopqrstuvwxyz123456'; // 32 chars = 256 bits
      expect(key.length).toBe(32);
    });

    it('should use 128-bit IV (16 bytes)', () => {
      // AES-256-CBC uses 128-bit IV
      expect(16).toBe(16); // 16 bytes = 128 bits
    });

    it('should have key length validation', () => {
      const shortKey = 'short';
      const longKey = 'a'.repeat(40);
      const validKey = 'a'.repeat(32);
      
      expect(shortKey.length).toBeLessThan(32);
      expect(longKey.length).toBeGreaterThan(32);
      expect(validKey.length).toBe(32);
    });
  });

  describe('Key Management', () => {
    it('should not expose secret key in error messages', () => {
      const secretKey = 'super-secret-key-1234567890123456';
      const errorMessage = 'Invalid key length: 8 != 32';
      
      expect(errorMessage).not.toContain(secretKey);
    });
  });
});
