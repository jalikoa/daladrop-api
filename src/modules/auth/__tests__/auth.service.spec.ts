import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { UsersService } from '../../users/users.service';
import * as bcrypt from 'bcryptjs';

const mockUser = {
  id: 1,
  uuid: '550e8400-e29b-41d4-a716-446655440000',
  email: 'alice@example.com',
  phone_number: null,
  password_hash: '$2b$10$hashedpassword',
  role: 'CUSTOMER',
  status: 'ACTIVE',
  is_active: true,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

const mockUsersService = {
  findUserWithPassword: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('signed.jwt.token'),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('1d'),
};

describe('AuthService', () => {
  let service: AuthService;

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
    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login()', () => {
    it('returns tokens and user on valid credentials', async () => {
      mockUsersService.findUserWithPassword.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const result = await service.login({ email: 'alice@example.com', password: 'password123' });

      expect(result.access_token).toBe('signed.jwt.token');
      expect(result.refresh_token).toBe('signed.jwt.token');
      expect(result.token_type).toBe('Bearer');
      expect(result.user.email).toBe('alice@example.com');
      expect(result.user.id).toBe(1);
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('throws UnauthorizedException when user is not found', async () => {
      mockUsersService.findUserWithPassword.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      mockUsersService.findUserWithPassword.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        service.login({ email: 'alice@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user has no password_hash', async () => {
      mockUsersService.findUserWithPassword.mockResolvedValue({
        ...mockUser,
        password_hash: null,
      });

      await expect(
        service.login({ email: 'alice@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('includes role in JWT payload', async () => {
      mockUsersService.findUserWithPassword.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await service.login({ email: 'alice@example.com', password: 'password123' });

      const signCall = mockJwtService.sign.mock.calls[0];
      expect(signCall[0]).toMatchObject({ sub: 1, email: 'alice@example.com', role: 'CUSTOMER' });
    });
  });

  describe('refreshToken()', () => {
    it('returns a new access token with valid refresh token', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 1 });
      mockUsersService.findOne.mockResolvedValue({
        id: 1, uuid: mockUser.uuid, email: mockUser.email, role: 'CUSTOMER',
      });

      const result = await service.refreshToken('valid.refresh.token');

      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBe('valid.refresh.token');
    });

    it('throws UnauthorizedException on expired/invalid refresh token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refreshToken('expired.token')).rejects.toThrow(UnauthorizedException);
    });
  });
});