import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthConfig } from '../domain/auth.config';
import { AuthTokenService } from '../domain/auth-token.service';
import {
  maskIdentifier,
  normalizeEmail,
  normalizeIdentifier,
  normalizeKenyanPhone,
  subjectRateLimitKey,
} from '../domain/auth-identity.util';
import { ConfigurableHumanChallengeVerifier } from '../adapters/human-challenge.verifier';
import { AuthTokenGuard } from '../guards/auth-token.guard';
import type { IdentityRepository } from '../repositories/identity.repository';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { AuthorizationService } from '../../authorization/use-cases/authorization.service';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSION } from '../../authorization/decorators/require-permission.decorator';
import {
  RbacEngine,
  PermissionEvaluator,
} from '../../../platform/security/authorization';
import type { PrismaService } from '../../../database/prisma/prisma.service';

function executionContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: jest.fn(),
      getNext: jest.fn(),
    }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  } as unknown as ExecutionContext;
}

describe('auth foundation', () => {
  it('normalizes and masks supported identifiers', () => {
    expect(normalizeEmail(' USER@Example.COM ')).toBe('user@example.com');
    expect(() => normalizeEmail('bad')).toThrow(BadRequestException);
    expect(normalizeKenyanPhone('0712 345 678')).toBe('254712345678');
    expect(normalizeKenyanPhone('0112-345-678')).toBe('254112345678');
    expect(normalizeKenyanPhone('+254712345678')).toBe('254712345678');
    expect(normalizeKenyanPhone('254712345678')).toBe('254712345678');
    expect(() => normalizeKenyanPhone('123')).toThrow(BadRequestException);
    expect(normalizeIdentifier('A@B.co')).toEqual({
      value: 'a@b.co',
      kind: 'email',
    });
    expect(normalizeIdentifier('0712345678')).toEqual({
      value: '254712345678',
      kind: 'phone',
    });
    expect(maskIdentifier('254712345678', 'phone')).toBe('25471***678');
    expect(maskIdentifier('alice@example.com', 'email')).toBe(
      'al***@example.com',
    );
    expect(maskIdentifier('x', 'email')).toBe('x***@');
    expect(subjectRateLimitKey('login', 'a', 'b')).toMatch(
      /^auth:login:[a-f0-9]{64}$/,
    );
  });

  it('provides fail-closed configurable human challenge behavior', async () => {
    await expect(
      new ConfigurableHumanChallengeVerifier(false).verify({
        action: 'login',
        subjectKey: 'key',
      }),
    ).resolves.toBe(true);
    await expect(
      new ConfigurableHumanChallengeVerifier(true).verify({
        token: 'anything',
        action: 'login',
        subjectKey: 'key',
      }),
    ).resolves.toBe(false);
  });

  it('reads auth configuration with defaults and valid overrides', () => {
    const previous = { ...process.env };
    // Isolate defaults from developer `.env` AUTH_* overrides.
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('AUTH_') || key === 'SMTP_FROM' || key === 'JWT_SECRET') {
        delete process.env[key];
      }
    }
    const service = new AuthConfig(
      new ConfigService({
        jwt: { secret: 'secret' },
        email: { from: 'from@test.dev' },
      }),
    );
    expect(service.jwtSecret).toBe('secret');
    expect(service.accessTtlSeconds).toBe(900);
    expect(service.refreshTtlSeconds).toBe(2_592_000);
    expect(service.otpTtlSeconds).toBe(300);
    expect(service.otpResendCooldownSeconds).toBe(60);
    expect(service.otpMaxAttempts).toBe(5);
    expect(service.otpSendsPerWindow).toBe(5);
    expect(service.otpSendWindowSeconds).toBe(900);
    expect(service.loginAttemptsPerWindow).toBe(10);
    expect(service.loginWindowSeconds).toBe(900);
    expect(service.humanChallengeRequired).toBe(false);
    expect(service.emailProvider).toBe('smtp');
    expect(service.smsProvider).toBe('http-sms');
    expect(service.emailFrom).toBe('from@test.dev');
    expect(service.totpIssuer).toBe('DalaDrop');

    process.env.AUTH_ACCESS_TTL_SECONDS = '60';
    process.env.AUTH_REFRESH_TTL_SECONDS = '61';
    process.env.AUTH_OTP_TTL_SECONDS = '62';
    process.env.AUTH_OTP_RESEND_COOLDOWN_SECONDS = '63';
    process.env.AUTH_OTP_MAX_ATTEMPTS = '6';
    process.env.AUTH_OTP_SENDS_PER_WINDOW = '7';
    process.env.AUTH_OTP_SEND_WINDOW_SECONDS = '64';
    process.env.AUTH_LOGIN_ATTEMPTS_PER_WINDOW = '8';
    process.env.AUTH_LOGIN_WINDOW_SECONDS = '65';
    process.env.AUTH_HUMAN_CHALLENGE_REQUIRED = 'true';
    process.env.AUTH_EMAIL_PROVIDER = 'ses';
    process.env.AUTH_SMS_PROVIDER = 'twilio';
    process.env.AUTH_TOTP_ISSUER = 'Issuer';
    const override = new AuthConfig(new ConfigService());
    expect([
      override.accessTtlSeconds,
      override.refreshTtlSeconds,
      override.otpTtlSeconds,
      override.otpResendCooldownSeconds,
      override.otpMaxAttempts,
      override.otpSendsPerWindow,
      override.otpSendWindowSeconds,
      override.loginAttemptsPerWindow,
      override.loginWindowSeconds,
    ]).toEqual([60, 61, 62, 63, 6, 7, 64, 8, 65]);
    expect(override.humanChallengeRequired).toBe(true);
    expect(override.emailProvider).toBe('ses');
    expect(override.smsProvider).toBe('twilio');
    expect(override.totpIssuer).toBe('Issuer');
    process.env.AUTH_ACCESS_TTL_SECONDS = '-1';
    expect(override.accessTtlSeconds).toBe(900);
    delete process.env.AUTH_TOTP_ISSUER;
    delete process.env.AUTH_EMAIL_PROVIDER;
    delete process.env.AUTH_SMS_PROVIDER;
    delete process.env.SMTP_FROM;
    const empty = new AuthConfig(new ConfigService());
    expect(empty.jwtSecret).toBe(process.env.JWT_SECRET ?? '');
    expect(empty.emailFrom).toBe('noreply@daladrop.local');
    delete process.env.JWT_SECRET;
    expect(new AuthConfig(new ConfigService()).jwtSecret).toBe('');
    process.env = previous;
  });

  it('issues, verifies, expires, hashes and compares tokens', async () => {
    const config = {
      jwtSecret: 'x'.repeat(32),
      accessTtlSeconds: 60,
    } as AuthConfig;
    const jwt = new JwtService();
    const service = new AuthTokenService(jwt, config);
    const principal = {
      id: 'user',
      sessionId: 'session',
      roles: ['CUSTOMER'],
      permissions: ['orders.read'],
    };
    const issued = await service.issueAccessToken(principal);
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
    await expect(service.verifyAccessToken(issued.token)).resolves.toEqual(
      principal,
    );
    await expect(service.verifyAccessToken('invalid')).resolves.toBeNull();
    const malformed = await jwt.signAsync(
      { sub: 'user', typ: 'wrong' },
      { secret: config.jwtSecret, expiresIn: 60 },
    );
    await expect(service.verifyAccessToken(malformed)).resolves.toBeNull();
    expect(service.randomOpaqueToken(8)).toHaveLength(11);
    expect(service.randomOpaqueToken()).toHaveLength(64);
    const digest = service.hashOpaqueToken('token');
    expect(service.tokenMatches('token', digest)).toBe(true);
    expect(service.tokenMatches('other', digest)).toBe(false);
    expect(service.tokenMatches('token', '00')).toBe(false);
  });

  it('authenticates bearer sessions and rejects invalid sessions', async () => {
    const tokens = {
      verifyAccessToken: jest.fn(),
    } as unknown as AuthTokenService;
    const repository = {
      findSession: jest.fn(),
      findUserById: jest.fn(),
    } as unknown as jest.Mocked<IdentityRepository>;
    const guard = new AuthTokenGuard(tokens, repository);
    const principal = {
      id: 'user',
      sessionId: 'session',
      roles: [],
      permissions: [],
    };
    (tokens.verifyAccessToken as jest.Mock).mockResolvedValue(principal);
    repository.findSession.mockResolvedValue({
      id: 'session',
      userId: 'user',
      previousRefreshTokenHash: null,
      absoluteExpiresAt: new Date(Date.now() + 86_400_000),
      refreshTokenHash: 'hash',
      rolesSnapshot: [],
      expiresAt: new Date(Date.now() + 1000),
      revokedAt: null,
    });
    repository.findUserById.mockResolvedValue({
      id: 'user',
      email: 'a@b.co',
      phone: null,
      phoneE164: null,
      firstName: 'A',
      lastName: 'B',
      displayName: 'A B',
      photoUrl: null,
      status: 'ACTIVE',
      passwordHash: null,
      mfaEnabled: false,
      preferredMfaMethod: null,
      roles: [],
    });
    const request = { headers: { authorization: 'Bearer token' } };
    await expect(guard.canActivate(executionContext(request))).resolves.toBe(
      true,
    );
    expect(request).toHaveProperty('user', principal);

    for (const invalid of [
      { headers: {} },
      { headers: { authorization: 'Basic token' } },
    ]) {
      await expect(
        guard.canActivate(executionContext(invalid)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    (tokens.verifyAccessToken as jest.Mock).mockResolvedValue(principal);
    for (const session of [
      null,
      {
        id: 'session',
        userId: 'other',
        previousRefreshTokenHash: null,
        absoluteExpiresAt: new Date(Date.now() + 86_400_000),
        refreshTokenHash: 'hash',
        rolesSnapshot: [],
        expiresAt: new Date(Date.now() + 1_000),
        revokedAt: null,
      },
      {
        id: 'session',
        userId: 'user',
        previousRefreshTokenHash: null,
        absoluteExpiresAt: new Date(Date.now() + 86_400_000),
        refreshTokenHash: 'hash',
        rolesSnapshot: [],
        expiresAt: new Date(Date.now() - 1),
        revokedAt: null,
      },
      {
        id: 'session',
        userId: 'user',
        previousRefreshTokenHash: null,
        absoluteExpiresAt: new Date(Date.now() + 86_400_000),
        refreshTokenHash: 'hash',
        rolesSnapshot: [],
        expiresAt: new Date(Date.now() + 1_000),
        revokedAt: new Date(),
      },
    ]) {
      repository.findSession.mockResolvedValueOnce(session as never);
      await expect(
        guard.canActivate(
          executionContext({ headers: { authorization: 'Bearer token' } }),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }

    repository.findSession.mockResolvedValue({
      id: 'session',
      userId: 'user',
      previousRefreshTokenHash: null,
      absoluteExpiresAt: new Date(Date.now() + 86_400_000),
      refreshTokenHash: 'hash',
      rolesSnapshot: [],
      expiresAt: new Date(Date.now() + 1000),
      revokedAt: null,
    });
    repository.findUserById.mockResolvedValueOnce(null);
    await expect(
      guard.canActivate(
        executionContext({ headers: { authorization: 'Bearer token' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    repository.findUserById.mockResolvedValueOnce({
      id: 'user',
      email: null,
      phone: null,
      phoneE164: null,
      firstName: null,
      lastName: null,
      displayName: null,
      photoUrl: null,
      status: 'SUSPENDED',
      passwordHash: null,
      mfaEnabled: false,
      preferredMfaMethod: null,
      roles: [],
    });
    await expect(
      guard.canActivate(
        executionContext({ headers: { authorization: 'Bearer token' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('loads database RBAC permissions through the platform evaluator', async () => {
    const prisma = {
      role: {
        findMany: jest.fn().mockResolvedValue([
          {
            code: 'ADMIN',
            permissions: [
              { permission: { action: 'read', resource: 'orders' } },
            ],
          },
        ]),
      },
    } as unknown as PrismaService;
    const rbac = new RbacEngine();
    const evaluator = {
      can: jest.fn().mockResolvedValue(true),
    } as unknown as PermissionEvaluator;
    const service = new AuthorizationService(prisma, rbac, evaluator);
    await expect(
      service.can(
        {
          id: 'u',
          sessionId: 's',
          roles: ['ADMIN'],
          permissions: [],
        },
        'read',
        'orders',
      ),
    ).resolves.toBe(true);
    expect(evaluator.can).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'read', resource: 'orders' }),
    );
  });

  it('enforces authorization metadata and permits unannotated routes', async () => {
    const reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;
    const authorization = {
      can: jest.fn(),
    } as unknown as AuthorizationService;
    const guard = new AuthorizationGuard(reflector, authorization);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    await expect(guard.canActivate(executionContext({}))).resolves.toBe(true);

    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      action: 'read',
      resource: 'orders',
    });
    const request = {
      user: {
        id: 'u',
        sessionId: 's',
        roles: [],
        permissions: [],
      },
    };
    (authorization.can as jest.Mock).mockResolvedValue(true);
    await expect(guard.canActivate(executionContext(request))).resolves.toBe(
      true,
    );
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      REQUIRED_PERMISSION,
      expect.any(Array),
    );
    (authorization.can as jest.Mock).mockResolvedValue(false);
    await expect(
      guard.canActivate(executionContext(request)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      guard.canActivate(executionContext({})),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
