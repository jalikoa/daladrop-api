import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';

jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'JBSWY3DPEHPK3PXP'),
  generateURI: jest.fn(
    ({ issuer, label }: { issuer: string; label: string }) =>
      `otpauth://totp/${issuer}:${label}`,
  ),
  verify: jest.fn(async () => ({ valid: true, delta: 0 })),
}));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(async () => 'data:image/png;base64,test'),
}));

import { AuthService } from '../use-cases/auth.service';
import type { IdentityRepository } from '../repositories/identity.repository';
import type { SocialTokenVerifier } from '../adapters/social-token.verifier';
import type { HumanChallengeVerifier } from '../adapters/human-challenge.verifier';
import type { PasswordService } from '../../../platform/security/password/password.service';
import type { BruteForceProtector } from '../../../platform/security/password/brute-force.protector';
import type { RateLimitService } from '../../../platform/security/http/rate-limit.service';
import type { AuthTokenService } from '../domain/auth-token.service';
import type { AuthConfig } from '../domain/auth.config';
import type { AuthJobDispatcher } from '../../notifications/use-cases/auth-job.dispatcher';
import type { EncryptionService } from '../../../common/security/encryption.service';
import type { AuthRequestContext } from '../domain/auth.contracts';

const context: AuthRequestContext = {
  deviceId: 'device',
  deviceFingerprint: 'fingerprint',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
  correlationId: 'request',
};

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'user@example.com',
  phone: null,
  phoneE164: '254712345678',
  firstName: 'Test',
  lastName: 'User',
  displayName: 'Test User',
  photoUrl: null,
  status: 'ACTIVE',
  passwordHash: 'password-hash',
  mfaEnabled: false,
  preferredMfaMethod: null,
  roles: [{ code: 'CUSTOMER', permissions: ['orders.read'] }],
} as const;

const config = {
  jwtSecret: 'j'.repeat(32),
  accessTtlSeconds: 900,
  refreshTtlSeconds: 2_592_000,
  sessionAbsoluteTtlSeconds: 7_776_000,
  otpTtlSeconds: 300,
  otpResendCooldownSeconds: 60,
  otpMaxAttempts: 5,
  otpSendsPerWindow: 5,
  otpSendWindowSeconds: 900,
  loginAttemptsPerWindow: 10,
  loginWindowSeconds: 900,
  totpIssuer: 'DalaDrop',
} as AuthConfig;

function otpHash(value: string): string {
  return createHmac('sha256', config.jwtSecret).update(value).digest('hex');
}

function mockRepository(): jest.Mocked<IdentityRepository> {
  const methods = [
    'findUserByIdentifier',
    'findUserById',
    'findUserBySocialIdentity',
    'createSocialUser',
    'createLocalUser',
    'createOtp',
    'findLatestOtp',
    'findOtpById',
    'updateOtp',
    'consumeSignupToken',
    'createSession',
    'findSession',
    'rotateSession',
    'revokeSession',
    'revokeAllSessions',
    'listActiveSessions',
    'touchLogin',
    'updatePassword',
    'updateUserPhone',
    'updateUserProfile',
    'softDeleteUser',
    'setUserStatus',
    'listUsers',
    'listLegalAcceptances',
    'createTotpFactor',
    'findMfaFactor',
    'findActiveMfaFactor',
    'activateMfaFactor',
    'touchMfaFactor',
    'disableMfa',
    'consumeRecoveryCode',
    'createMfaLoginChallenge',
    'findMfaLoginChallenge',
    'failMfaLoginChallenge',
    'consumeMfaLoginChallenge',
  ];
  return Object.fromEntries(
    methods.map((method) => [method, jest.fn()]),
  ) as unknown as jest.Mocked<IdentityRepository>;
}

function setup() {
  const repository = mockRepository();
  const social = {
    verify: jest.fn(),
  } as jest.Mocked<SocialTokenVerifier>;
  const human = {
    verify: jest.fn().mockResolvedValue(true),
  } as jest.Mocked<HumanChallengeVerifier>;
  const passwords = {
    verify: jest.fn().mockResolvedValue(true),
    hash: jest.fn().mockResolvedValue('new-hash'),
  } as unknown as jest.Mocked<PasswordService>;
  const brute = {
    assertAllowed: jest.fn(),
    recordFailure: jest.fn(),
    recordSuccess: jest.fn(),
  } as unknown as jest.Mocked<BruteForceProtector>;
  const rateLimits = {
    consume: jest.fn().mockResolvedValue({
      allowed: true,
      count: 1,
      remaining: 4,
      resetAt: Date.now() + 60_000,
    }),
  } as unknown as jest.Mocked<RateLimitService>;
  const tokens = {
    randomOpaqueToken: jest.fn().mockReturnValue('opaque-token'),
    hashOpaqueToken: jest.fn((value: string) => `hash:${value}`),
    tokenMatches: jest.fn().mockReturnValue(true),
    issueAccessToken: jest.fn().mockResolvedValue({
      token: 'access-token',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
    }),
  } as unknown as jest.Mocked<AuthTokenService>;
  const jobs = {
    dispatch: jest.fn().mockResolvedValue('job-id'),
  } as unknown as jest.Mocked<AuthJobDispatcher>;
  const encryption = {
    encryptPayload: jest.fn().mockReturnValue('encrypted-secret'),
    decryptPayload: jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  } as unknown as jest.Mocked<EncryptionService>;
  const service = new AuthService(
    repository,
    social,
    human,
    passwords,
    brute,
    rateLimits,
    tokens,
    config,
    jobs,
    encryption,
  );
  return {
    service,
    repository,
    social,
    human,
    passwords,
    brute,
    rateLimits,
    tokens,
    jobs,
    encryption,
  };
}

function otp(overrides: Record<string, unknown> = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    userId: user.id,
    identifier: 'user@example.com',
    channel: 'EMAIL',
    purpose: 'SIGNUP',
    codeHash: otpHash('123456'),
    attempts: 0,
    maxAttempts: 5,
    signupTokenHash: null,
    expiresAt: new Date(Date.now() + 60_000),
    verifiedAt: null,
    consumedAt: null,
    sentAt: null,
    resendCount: 0,
    deliveryJobId: null,
    createdAt: new Date(Date.now() - 61_000),
    ...overrides,
  } as never;
}

describe('AuthService', () => {
  it('logs in active password users and emits an async audit job', async () => {
    const { service, repository, passwords, brute, jobs } = setup();
    repository.findUserByIdentifier.mockResolvedValue(user);
    repository.createSession.mockResolvedValue({} as never);
    await expect(
      service.login(
        { email: 'USER@example.com', password: 'password' },
        context,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        success: true,
        token: 'access-token',
        user: expect.objectContaining({
          id: user.id,
          surname: 'User',
          phone: '254712345678',
        }),
      }),
    );
    expect(passwords.verify).toHaveBeenCalled();
    expect(brute.recordSuccess).toHaveBeenCalled();
    expect(repository.touchLogin).toHaveBeenCalledWith(user.id);
    expect(jobs.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'record-auth-audit', success: true }),
    );
  });

  it('rejects invalid credentials and records account-keyed failures', async () => {
    const { service, repository, passwords, brute, jobs } = setup();
    repository.findUserByIdentifier.mockResolvedValue(null);
    await expect(
      service.login({ email: 'user@example.com', password: 'wrong' }, context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(passwords.verify).not.toHaveBeenCalled();
    expect(brute.recordFailure).toHaveBeenCalled();
    expect(jobs.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'record-auth-audit',
        success: false,
      }),
    );
  });

  it('starts and completes single-use TOTP MFA login challenges', async () => {
    const { service, repository } = setup();
    repository.findUserByIdentifier.mockResolvedValue({
      ...user,
      mfaEnabled: true,
      preferredMfaMethod: 'TOTP',
    });
    repository.findActiveMfaFactor.mockResolvedValue({
      id: 'factor',
      userId: user.id,
      method: 'TOTP',
      status: 'ACTIVE',
      secretEncrypted: 'secret',
      deliveryIdentifier: null,
    });
    repository.createMfaLoginChallenge.mockResolvedValue({
      id: 'challenge',
      userId: user.id,
      factorId: 'factor',
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    const started = await service.login(
      { email: user.email, password: 'password' },
      context,
    );
    expect(started).toEqual(
      expect.objectContaining({
        mfaRequired: true,
        mfaChallengeId: 'challenge',
        method: 'TOTP',
      }),
    );

    repository.findMfaLoginChallenge.mockResolvedValue({
      id: 'challenge',
      userId: user.id,
      factorId: 'factor',
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    repository.findMfaFactor.mockResolvedValue({
      id: 'factor',
      userId: user.id,
      method: 'TOTP',
      status: 'ACTIVE',
      secretEncrypted: 'secret',
      deliveryIdentifier: null,
    });
    // RFC 6238 verification is covered by the library; force the private
    // boundary result to focus this test on challenge consumption.
    jest
      .spyOn(service as never, 'verifyFactor' as never)
      .mockResolvedValue(true as never);
    repository.consumeMfaLoginChallenge.mockResolvedValue(true);
    repository.findUserById.mockResolvedValue(user);
    repository.createSession.mockResolvedValue({} as never);
    await expect(
      service.verifyMfaLogin('challenge', '123456', context),
    ).resolves.toEqual(expect.objectContaining({ token: 'access-token' }));
    expect(repository.consumeMfaLoginChallenge).toHaveBeenCalled();
  });

  it('rejects failed, expired and replayed TOTP challenges', async () => {
    const { service, repository } = setup();
    repository.findMfaLoginChallenge.mockResolvedValue({
      id: 'challenge',
      userId: user.id,
      factorId: 'factor',
      attempts: 5,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    await expect(
      service.verifyMfaLogin('challenge', 'bad', context),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    repository.findMfaLoginChallenge.mockResolvedValue({
      id: 'challenge',
      userId: user.id,
      factorId: 'factor',
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    repository.findMfaFactor.mockResolvedValue(null);
    await expect(
      service.verifyMfaLogin('challenge', 'bad', context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.failMfaLoginChallenge).toHaveBeenCalled();

    repository.findMfaFactor.mockResolvedValue({
      id: 'factor',
      userId: user.id,
      method: 'TOTP',
      status: 'ACTIVE',
      secretEncrypted: 'secret',
      deliveryIdentifier: null,
    });
    jest
      .spyOn(service as never, 'verifyFactor' as never)
      .mockResolvedValue(true as never);
    repository.consumeMfaLoginChallenge.mockResolvedValue(false);
    await expect(
      service.verifyMfaLogin('challenge', '123456', context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('requests, resends and verifies signup OTPs', async () => {
    const { service, repository, jobs, tokens } = setup();
    repository.findUserByIdentifier.mockResolvedValue(null);
    repository.findLatestOtp.mockResolvedValue(null);
    repository.createOtp.mockImplementation(async (input) => otp(input));
    await expect(
      service.requestSignupOtp('user@example.com', undefined, context),
    ).resolves.toEqual({
      success: true,
      masked: 'us***@example.com',
      retryAfterSeconds: 60,
    });
    expect(jobs.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'deliver-otp', channel: 'EMAIL' }),
    );

    repository.findLatestOtp.mockResolvedValue(otp());
    await service.resendSignupOtp('user@example.com', undefined, context);
    expect(repository.createOtp).toHaveBeenLastCalledWith(
      expect.objectContaining({ resendCount: 1 }),
    );

    repository.findLatestOtp.mockResolvedValue(otp());
    tokens.randomOpaqueToken.mockReturnValue('signup-token');
    await expect(
      service.verifySignupOtp('user@example.com', '123456'),
    ).resolves.toEqual({
      success: true,
      signupToken: 'signup-token',
      verifiedEmail: 'user@example.com',
    });
    expect(repository.updateOtp).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        verifiedAt: expect.any(Date),
        signupTokenHash: 'hash:signup-token',
      }),
    );
  });

  it('enforces OTP cooldown, resend precondition, anti-bot and send limits', async () => {
    const { service, repository, human, rateLimits } = setup();
    repository.findLatestOtp.mockResolvedValue(otp({ createdAt: new Date() }));
    await expect(
      service.requestSignupOtp('user@example.com', undefined, context),
    ).rejects.toBeInstanceOf(HttpException);

    repository.findLatestOtp.mockResolvedValue(null);
    await expect(
      service.resendSignupOtp('user@example.com', undefined, context),
    ).rejects.toBeInstanceOf(BadRequestException);

    human.verify.mockResolvedValue(false);
    await expect(
      service.requestSignupOtp('user@example.com', undefined, context),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    human.verify.mockResolvedValue(true);
    rateLimits.consume.mockResolvedValue({
      allowed: false,
      count: 6,
      remaining: 0,
      resetAt: Date.now() + 1_000,
    });
    await expect(
      service.requestSignupOtp('user@example.com', undefined, context),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('keeps forgot-password responses enumeration safe and resets verified users', async () => {
    const { service, repository, passwords } = setup();
    repository.findLatestOtp.mockResolvedValue(null);
    repository.findUserByIdentifier.mockResolvedValue(null);
    await expect(
      service.forgotPassword('user@example.com', undefined, context),
    ).resolves.toEqual(
      expect.objectContaining({ success: true, channel: 'EMAIL' }),
    );
    expect(repository.createOtp).not.toHaveBeenCalled();

    repository.findLatestOtp.mockResolvedValue(
      otp({ purpose: 'RESET_PASSWORD', verifiedAt: new Date() }),
    );
    repository.findUserByIdentifier.mockResolvedValue(user);
    await expect(
      service.verifyResetOtp('user@example.com', '123456'),
    ).resolves.toEqual({ success: true });
    await expect(
      service.resetPassword('user@example.com', '123456', 'NewPassword1!'),
    ).resolves.toEqual({ success: true });
    expect(passwords.hash).toHaveBeenCalled();
    expect(repository.updatePassword).toHaveBeenCalled();
  });

  it('rejects invalid reset challenges', async () => {
    const { service, repository } = setup();
    repository.findLatestOtp.mockResolvedValue(null);
    await expect(
      service.resetPassword('user@example.com', '123456', 'NewPassword1!'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    repository.findLatestOtp.mockResolvedValue(
      otp({ purpose: 'RESET_PASSWORD', verifiedAt: new Date() }),
    );
    repository.findUserByIdentifier.mockResolvedValue(null);
    await expect(
      service.resetPassword('user@example.com', '123456', 'NewPassword1!'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('registers a verified user and validates registration invariants', async () => {
    const { service, repository } = setup();
    const input = {
      firstName: 'Test',
      lastName: 'User',
      email: 'USER@example.com',
      password: 'StrongPassword1!',
      confirmPassword: 'StrongPassword1!',
      signupToken: 'signup',
      legalAcceptance: {
        termsVersion: 'terms-v1',
        privacyVersion: 'privacy-v1',
        signatureName: 'Test User',
      },
    };
    repository.findUserByIdentifier.mockResolvedValue(null);
    repository.consumeSignupToken.mockResolvedValue(true);
    repository.createLocalUser.mockResolvedValue(user);
    repository.createSession.mockResolvedValue({} as never);
    await expect(service.register(input, context)).resolves.toEqual(
      expect.objectContaining({ success: true, token: 'access-token' }),
    );

    await expect(
      service.register({ ...input, confirmPassword: 'different' }, context),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.register(
        { ...input, email: undefined, phone: undefined },
        context,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    repository.findUserByIdentifier.mockResolvedValue(user);
    await expect(service.register(input, context)).rejects.toBeInstanceOf(
      ConflictException,
    );
    repository.findUserByIdentifier.mockResolvedValue(null);
    repository.consumeSignupToken.mockResolvedValue(false);
    await expect(service.register(input, context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rotates refresh tokens and rejects invalid refresh state', async () => {
    const { service, repository, tokens } = setup();
    repository.findSession.mockResolvedValue({
      id: 'session',
      userId: user.id,
      previousRefreshTokenHash: null,
      absoluteExpiresAt: new Date(Date.now() + 86_400_000),
      refreshTokenHash: 'hash',
      rolesSnapshot: ['CUSTOMER'],
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    repository.findUserById.mockResolvedValue(user);
    tokens.randomOpaqueToken.mockReturnValue('next-refresh');
    await expect(service.refresh('session', 'refresh')).resolves.toEqual(
      expect.objectContaining({
        success: true,
        refreshToken: 'next-refresh',
      }),
    );
    expect(repository.rotateSession).toHaveBeenCalled();

    tokens.tokenMatches.mockReturnValue(false);
    await expect(service.refresh('session', 'bad')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    tokens.tokenMatches.mockReturnValue(true);
    repository.findUserById.mockResolvedValue({
      ...user,
      status: 'SUSPENDED',
    });
    await expect(service.refresh('session', 'refresh')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('enforces absolute session expiry and revokes on refresh-token reuse', async () => {
    const { service, repository, tokens } = setup();
    repository.findSession.mockResolvedValue({
      id: 'session',
      userId: user.id,
      previousRefreshTokenHash: null,
      absoluteExpiresAt: new Date(Date.now() - 1_000),
      refreshTokenHash: 'hash',
      rolesSnapshot: ['CUSTOMER'],
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    await expect(service.refresh('session', 'refresh')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(repository.revokeSession).toHaveBeenCalledWith('session');

    repository.revokeSession.mockClear();
    tokens.tokenMatches
      .mockReturnValueOnce(false) // current hash
      .mockReturnValueOnce(true); // previous hash
    repository.findSession.mockResolvedValue({
      id: 'session',
      userId: user.id,
      previousRefreshTokenHash: 'old-hash',
      absoluteExpiresAt: new Date(Date.now() + 86_400_000),
      refreshTokenHash: 'hash',
      rolesSnapshot: ['CUSTOMER'],
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    await expect(service.refresh('session', 'stolen')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(repository.revokeSession).toHaveBeenCalledWith('session');
  });

  it('lists and revokes device sessions for the current user', async () => {
    const { service, repository } = setup();
    repository.listActiveSessions.mockResolvedValue([
      {
        sessionId: 'session',
        deviceId: 'd1',
        platform: 'ios',
        model: 'iPhone',
        ip: '1.1.1.1',
        userAgent: 'ua',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        current: true,
      },
    ]);
    await expect(service.listDevices(user.id, 'session')).resolves.toEqual({
      success: true,
      devices: [expect.objectContaining({ sessionId: 'session', current: true })],
    });

    repository.findSession.mockResolvedValue({
      id: 'other',
      userId: user.id,
      previousRefreshTokenHash: null,
      absoluteExpiresAt: new Date(Date.now() + 86_400_000),
      refreshTokenHash: 'hash',
      rolesSnapshot: ['CUSTOMER'],
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    await expect(
      service.revokeDevice(user.id, 'other', 'session'),
    ).resolves.toEqual({ success: true });
    expect(repository.revokeSession).toHaveBeenCalledWith('other');

    repository.findSession.mockResolvedValue(null);
    await expect(
      service.revokeDevice(user.id, 'missing', 'session'),
    ).rejects.toBeInstanceOf(NotFoundException);

    repository.revokeAllSessions.mockResolvedValue(2);
    await expect(
      service.revokeOtherDevices(user.id, 'session'),
    ).resolves.toEqual({ success: true, revoked: 2 });
  });

  it('supports profile, legal, logout and social boundaries', async () => {
    const { service, repository, social } = setup();
    await expect(service.updatePhone(user.id, '0712345678')).resolves.toEqual({
      success: true,
    });
    repository.listLegalAcceptances.mockResolvedValue([]);
    await expect(service.legalAcceptances(user.id)).resolves.toEqual({
      acceptances: [],
    });
    await expect(service.logout('session')).resolves.toEqual({ success: true });

    social.verify.mockResolvedValue(null);
    await expect(
      service.socialLogin(
        'google',
        { idToken: 'token', role: 'CUSTOMER' },
        context,
      ),
    ).rejects.toBeInstanceOf(NotImplementedException);

    social.verify.mockResolvedValue({
      providerUserId: 'provider-user',
      email: user.email,
    });
    repository.findUserBySocialIdentity.mockResolvedValue(null);
    repository.createSocialUser.mockResolvedValue(user);
    repository.createSession.mockResolvedValue({} as never);
    await expect(
      service.socialLogin(
        'google',
        { idToken: 'token', role: 'CUSTOMER' },
        context,
      ),
    ).resolves.toEqual(expect.objectContaining({ isNewUser: true }));
    repository.findUserBySocialIdentity.mockResolvedValue(user);
    await expect(
      service.socialLogin(
        'apple',
        { identityToken: 'token', role: 'CUSTOMER' },
        context,
      ),
    ).resolves.toEqual(expect.objectContaining({ isNewUser: false }));
  });

  it('enrolls, activates and disables TOTP with recovery support', async () => {
    const { service, repository, tokens } = setup();
    repository.findUserById.mockResolvedValue(user);
    repository.createTotpFactor.mockResolvedValue({
      id: 'factor',
      userId: user.id,
      method: 'TOTP',
      status: 'PENDING',
      secretEncrypted: 'secret',
      deliveryIdentifier: null,
    });
    await expect(service.enrollTotp(user.id, 'Phone')).resolves.toEqual(
      expect.objectContaining({
        success: true,
        factorId: 'factor',
        otpauthUri: expect.stringMatching(/^otpauth:/),
        qrCodeDataUrl: expect.stringMatching(/^data:image\/png/),
      }),
    );

    const factor = {
      id: 'factor',
      userId: user.id,
      method: 'TOTP',
      status: 'PENDING',
      secretEncrypted: 'secret',
      deliveryIdentifier: null,
    } as const;
    repository.findMfaFactor.mockResolvedValue(factor);
    jest
      .spyOn(service as never, 'verifyFactor' as never)
      .mockResolvedValue(true as never);
    tokens.randomOpaqueToken.mockReturnValue('recovery');
    await expect(
      service.verifyTotpEnrollment(user.id, 'factor', '123456'),
    ).resolves.toEqual({
      success: true,
      recoveryCodes: Array(10).fill('recovery'),
    });
    expect(repository.activateMfaFactor).toHaveBeenCalled();

    repository.findActiveMfaFactor.mockResolvedValue({
      ...factor,
      status: 'ACTIVE',
    });
    await expect(service.disableMfa(user.id, '123456')).resolves.toEqual({
      success: true,
    });
    repository.findActiveMfaFactor.mockResolvedValue(null);
    repository.consumeRecoveryCode.mockResolvedValue(true);
    await expect(service.disableMfa(user.id, 'recovery')).resolves.toEqual({
      success: true,
    });
    repository.consumeRecoveryCode.mockResolvedValue(false);
    await expect(service.disableMfa(user.id, 'bad')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('supports phone signup/reset OTP paths and known-user resend', async () => {
    const { service, repository } = setup();
    repository.findLatestOtp.mockResolvedValue(null);
    repository.findUserByIdentifier.mockResolvedValue(null);
    repository.createOtp.mockImplementation(async (input) => otp(input));
    await service.requestSignupOtp('0712345678', undefined, context);
    expect(repository.createOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: '254712345678',
        channel: 'SMS',
      }),
    );
    repository.findLatestOtp.mockResolvedValue(
      otp({
        identifier: '254712345678',
        channel: 'SMS',
        createdAt: new Date(Date.now() - 61_000),
      }),
    );
    await expect(
      service.verifySignupOtp('0712345678', '123456'),
    ).resolves.toEqual(
      expect.objectContaining({ verifiedPhone: '254712345678' }),
    );

    repository.findLatestOtp.mockResolvedValue(
      otp({
        purpose: 'RESET_PASSWORD',
        createdAt: new Date(Date.now() - 61_000),
      }),
    );
    repository.findUserByIdentifier.mockResolvedValue(user);
    await expect(
      service.resendResetOtp('user@example.com', undefined, context),
    ).resolves.toEqual(expect.objectContaining({ success: true }));
  });

  it('starts email MFA, verifies its OTP and supports resend', async () => {
    const { service, repository } = setup();
    repository.findUserByIdentifier.mockResolvedValue({
      ...user,
      mfaEnabled: true,
      preferredMfaMethod: 'EMAIL',
    });
    repository.findActiveMfaFactor.mockResolvedValue({
      id: 'factor',
      userId: user.id,
      method: 'EMAIL',
      status: 'ACTIVE',
      secretEncrypted: null,
      deliveryIdentifier: user.email,
    });
    repository.createOtp.mockImplementation(async (input) =>
      otp({ ...input, purpose: 'LOGIN' }),
    );
    const started = await service.login(
      { email: user.email, password: 'password' },
      context,
    );
    expect(started).toEqual(
      expect.objectContaining({ mfaRequired: true, method: 'EMAIL' }),
    );

    repository.findMfaLoginChallenge.mockResolvedValue(null);
    repository.findOtpById.mockResolvedValue(
      otp({ purpose: 'LOGIN', userId: user.id }),
    );
    repository.findUserById.mockResolvedValue(user);
    repository.createSession.mockResolvedValue({} as never);
    await expect(
      service.verifyMfaLogin('otp-id', '123456', context),
    ).resolves.toEqual(expect.objectContaining({ token: 'access-token' }));

    repository.findOtpById.mockResolvedValue(
      otp({
        purpose: 'LOGIN',
        userId: user.id,
        createdAt: new Date(Date.now() - 61_000),
      }),
    );
    await expect(service.resendMfaLogin('otp-id', context)).resolves.toEqual(
      expect.objectContaining({ success: true }),
    );
  });

  it('rejects invalid OTP MFA challenges and resend cooldowns', async () => {
    const { service, repository } = setup();
    repository.findMfaLoginChallenge.mockResolvedValue(null);
    repository.findOtpById.mockResolvedValue(null);
    await expect(
      service.verifyMfaLogin('missing', '123456', context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.resendMfaLogin('missing', context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    repository.findOtpById.mockResolvedValue(
      otp({ purpose: 'LOGIN', createdAt: new Date() }),
    );
    await expect(
      service.resendMfaLogin('otp-id', context),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('counts incorrect OTPs and rejects exhausted or missing OTPs', async () => {
    const { service, repository } = setup();
    repository.findLatestOtp.mockResolvedValue(null);
    await expect(
      service.verifySignupOtp('user@example.com', '123456'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    repository.findLatestOtp.mockResolvedValue(
      otp({ attempts: 5, maxAttempts: 5 }),
    );
    await expect(
      service.verifySignupOtp('user@example.com', '123456'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    repository.findLatestOtp.mockResolvedValue(otp());
    await expect(
      service.verifySignupOtp('user@example.com', '000000'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.updateOtp).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ attempts: 1 }),
    );
  });

  it('validates MFA configuration and enrollment ownership', async () => {
    const { service, repository } = setup();
    repository.findUserByIdentifier.mockResolvedValue({
      ...user,
      mfaEnabled: true,
      preferredMfaMethod: null,
    });
    await expect(
      service.login({ email: user.email, password: 'password' }, context),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    repository.findUserByIdentifier.mockResolvedValue({
      ...user,
      mfaEnabled: true,
      preferredMfaMethod: 'TOTP',
    });
    repository.findActiveMfaFactor.mockResolvedValue(null);
    await expect(
      service.login({ email: user.email, password: 'password' }, context),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    repository.findUserById.mockResolvedValue(null);
    await expect(service.enrollTotp(user.id)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    repository.findMfaFactor.mockResolvedValue(null);
    await expect(
      service.verifyTotpEnrollment(user.id, 'factor', '123456'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('executes the real TOTP factor boundary and rejects other factors', async () => {
    const { service } = setup();
    await expect(
      (
        service as unknown as {
          verifyFactor(factor: unknown, code: string): Promise<boolean>;
        }
      ).verifyFactor(
        {
          method: 'TOTP',
          secretEncrypted: 'encrypted',
        },
        '123456',
      ),
    ).resolves.toBe(true);
    await expect(
      (
        service as unknown as {
          verifyFactor(factor: unknown, code: string): Promise<boolean>;
        }
      ).verifyFactor(
        {
          method: 'EMAIL',
          secretEncrypted: null,
        },
        '123456',
      ),
    ).resolves.toBe(false);
  });

  it('swallows only asynchronous audit enqueue failures', async () => {
    const { service, repository, jobs } = setup();
    repository.findUserByIdentifier.mockResolvedValue(null);
    jobs.dispatch.mockRejectedValue(new Error('queue unavailable'));
    await expect(
      service.login({ email: user.email, password: 'bad' }, context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await new Promise((resolve) => setImmediate(resolve));
    expect(jobs.dispatch).toHaveBeenCalled();
  });

  it('covers phone registration and password-reset channel selection', async () => {
    const { service, repository } = setup();
    repository.findLatestOtp.mockResolvedValue(null);
    repository.findUserByIdentifier.mockResolvedValue(null);
    await expect(
      service.forgotPassword('0712345678', undefined, context),
    ).resolves.toEqual(
      expect.objectContaining({ channel: 'SMS', masked: '25471***678' }),
    );

    repository.consumeSignupToken.mockResolvedValue(true);
    repository.createLocalUser.mockResolvedValue({
      ...user,
      email: null,
      phone: '0712345678',
      phoneE164: null,
    });
    repository.createSession.mockResolvedValue({} as never);
    await expect(
      service.register(
        {
          firstName: 'Phone',
          lastName: 'User',
          phone: '0712345678',
          password: 'StrongPassword1!',
          confirmPassword: 'StrongPassword1!',
          signupToken: 'signup',
          legalAcceptance: {
            termsVersion: 'terms',
            privacyVersion: 'privacy',
            signatureName: 'Phone User',
          },
        },
        context,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ phone: '0712345678' }),
      }),
    );
    expect(repository.createLocalUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: undefined,
        phone: '254712345678',
      }),
    );
  });

  it('rejects missing users after successful MFA verification', async () => {
    const { service, repository } = setup();
    repository.findMfaLoginChallenge.mockResolvedValue({
      id: 'challenge',
      userId: user.id,
      factorId: 'factor',
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    repository.findMfaFactor.mockResolvedValue({
      id: 'factor',
      userId: user.id,
      method: 'TOTP',
      status: 'ACTIVE',
      secretEncrypted: 'secret',
      deliveryIdentifier: null,
    });
    jest
      .spyOn(service as never, 'verifyFactor' as never)
      .mockResolvedValue(true as never);
    repository.consumeMfaLoginChallenge.mockResolvedValue(true);
    repository.findUserById.mockResolvedValue(null);
    await expect(
      service.verifyMfaLogin('challenge', '123456', context),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    repository.findMfaLoginChallenge.mockResolvedValue(null);
    repository.findOtpById.mockResolvedValue(
      otp({ purpose: 'LOGIN', userId: user.id }),
    );
    await expect(
      service.verifyMfaLogin('otp', '123456', context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('starts SMS MFA and rejects a factor without a destination', async () => {
    const { service, repository } = setup();
    repository.findUserByIdentifier.mockResolvedValue({
      ...user,
      mfaEnabled: true,
      preferredMfaMethod: 'SMS',
    });
    repository.findActiveMfaFactor.mockResolvedValue({
      id: 'factor',
      userId: user.id,
      method: 'SMS',
      status: 'ACTIVE',
      secretEncrypted: null,
      deliveryIdentifier: '254712345678',
    });
    repository.createOtp.mockImplementation(async (input) =>
      otp({ ...input, purpose: 'LOGIN' }),
    );
    await expect(
      service.login({ email: user.email, password: 'password' }, context),
    ).resolves.toEqual(
      expect.objectContaining({ method: 'SMS', masked: '25471***678' }),
    );
    repository.findActiveMfaFactor.mockResolvedValue({
      id: 'factor',
      userId: user.id,
      method: 'SMS',
      status: 'ACTIVE',
      secretEncrypted: null,
      deliveryIdentifier: null,
    });
    await expect(
      service.login({ email: user.email, password: 'password' }, context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('masks SMS MFA resend and rejects signup OTP for existing accounts', async () => {
    const { service, repository } = setup();
    repository.findOtpById.mockResolvedValue(
      otp({
        purpose: 'LOGIN',
        channel: 'SMS',
        identifier: '254712345678',
        createdAt: new Date(Date.now() - 61_000),
      }),
    );
    repository.createOtp.mockImplementation(async (input) => otp(input));
    await expect(service.resendMfaLogin('otp', context)).resolves.toEqual(
      expect.objectContaining({ masked: '25471***678' }),
    );

    repository.findLatestOtp.mockResolvedValue(null);
    repository.findUserByIdentifier.mockResolvedValue(user);
    await expect(
      service.requestSignupOtp(user.email, undefined, context),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses phone and id as TOTP labels when email is absent', async () => {
    const { service, repository } = setup();
    repository.createTotpFactor.mockResolvedValue({
      id: 'factor',
      userId: user.id,
      method: 'TOTP',
      status: 'PENDING',
      secretEncrypted: 'secret',
      deliveryIdentifier: null,
    });
    repository.findUserById.mockResolvedValue({
      ...user,
      email: null,
      phoneE164: '254712345678',
    });
    await service.enrollTotp(user.id);
    repository.findUserById.mockResolvedValue({
      ...user,
      email: null,
      phone: null,
      phoneE164: null,
    });
    await service.enrollTotp(user.id);
  });
});
