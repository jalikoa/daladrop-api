import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../auth.controller';
import { AuthService } from '../services/auth.service';
import { AuthLoggingInterceptor } from '../interceptors/auth-logging.interceptor';

const mockAuthResponse = {
  access_token: 'signed.jwt.token',
  refresh_token: 'signed.refresh.token',
  token_type: 'Bearer',
  expires_in: 86400,
  user: { id: 1, uuid: 'uuid-123', email: 'alice@example.com', role: 'CUSTOMER' },
};

const mockAuthService = {
  login: jest.fn(),
  refreshToken: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideInterceptor(AuthLoggingInterceptor)
      .useValue({ intercept: (_ctx: any, next: any) => next.handle() })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  describe('POST /auth/login', () => {
    it('returns tokens on valid credentials', async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);
      const result = await controller.login({ email: 'alice@example.com', password: 'password123' });
      expect(result.access_token).toBe('signed.jwt.token');
      expect(result.token_type).toBe('Bearer');
    });

    it('propagates UnauthorizedException for wrong credentials', async () => {
      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));
      await expect(
        controller.login({ email: 'wrong@example.com', password: 'bad' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('passes the full LoginDto to AuthService', async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);
      await controller.login({ email: 'alice@example.com', password: 'password123' });
      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: 'alice@example.com',
        password: 'password123',
      });
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns new tokens on valid refresh token', async () => {
      mockAuthService.refreshToken.mockResolvedValue(mockAuthResponse);
      const result = await controller.refresh('valid.refresh.token');
      expect(result.access_token).toBeDefined();
    });

    it('propagates UnauthorizedException for expired refresh token', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token'),
      );
      await expect(controller.refresh('expired.token')).rejects.toThrow(UnauthorizedException);
    });
  });
});