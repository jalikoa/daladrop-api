import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { generateSecret, generateURI, verify } from 'otplib';
import { toDataURL } from 'qrcode';
import { PasswordService } from '../../../platform/security/password/password.service';
import { BruteForceProtector } from '../../../platform/security/password/brute-force.protector';
import { RateLimitService } from '../../../platform/security/http/rate-limit.service';
import { EncryptionService } from '../../../common/security/encryption.service';
import {
  AUTH_SOCIAL_VERIFIER,
  HUMAN_CHALLENGE_VERIFIER,
  IDENTITY_REPOSITORY,
} from '../constants/auth.constants';
import type { HumanChallengeVerifier } from '../adapters/human-challenge.verifier';
import type {
  SocialProvider,
  SocialTokenVerifier,
} from '../adapters/social-token.verifier';
import { AuthJobDispatcher } from '../../notifications/use-cases/auth-job.dispatcher';
import { AuthConfig } from '../domain/auth.config';
import { AuthTokenService } from '../domain/auth-token.service';
import type {
  AuthMfaMethod,
  AuthOtpPurpose,
  AuthPrincipalView,
  AuthRequestContext,
  AuthSessionView,
  AuthUserView,
  MfaRequiredView,
} from '../domain/auth.contracts';
import {
  maskIdentifier,
  normalizeEmail,
  normalizeIdentifier,
  normalizeKenyanPhone,
  subjectRateLimitKey,
} from '../domain/auth-identity.util';
import type {
  IdentityDeviceSessionView,
  IdentityMfaFactorRecord,
  IdentityOtpRecord,
  IdentityRepository,
  IdentityUserRecord,
} from '../repositories/identity.repository';
import type {
  AppleLoginDto,
  GoogleLoginDto,
  LoginDto,
  RegisterDto,
} from '../dto/auth.dto';

@Injectable()
export class AuthService {
  public constructor(
    @Inject(IDENTITY_REPOSITORY)
    private readonly repository: IdentityRepository,
    @Inject(AUTH_SOCIAL_VERIFIER)
    private readonly socialVerifier: SocialTokenVerifier,
    @Inject(HUMAN_CHALLENGE_VERIFIER)
    private readonly humanChallenge: HumanChallengeVerifier,
    private readonly passwords: PasswordService,
    private readonly bruteForce: BruteForceProtector,
    private readonly rateLimits: RateLimitService,
    private readonly tokens: AuthTokenService,
    private readonly config: AuthConfig,
    private readonly jobs: AuthJobDispatcher,
    private readonly encryption: EncryptionService,
  ) {}

  public async login(
    input: LoginDto,
    context: AuthRequestContext,
  ): Promise<AuthSessionView | MfaRequiredView> {
    const identifier = normalizeEmail(input.email);
    const key = subjectRateLimitKey(
      'login',
      identifier,
      context.deviceFingerprint,
    );
    await this.assertHuman(input.captchaToken, 'login', key);
    await this.consumeLimit(
      key,
      this.config.loginAttemptsPerWindow,
      this.config.loginWindowSeconds,
    );
    this.bruteForce.assertAllowed(key);

    const user = await this.repository.findUserByIdentifier(identifier);
    const valid =
      user?.status === 'ACTIVE' &&
      Boolean(user.passwordHash) &&
      (await this.passwords.verify(input.password, user!.passwordHash!));

    if (!valid) {
      this.bruteForce.recordFailure(key);
      this.audit({
        identifier,
        userId: user?.id,
        success: false,
        failureReason: 'INVALID_CREDENTIALS',
        context,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    this.bruteForce.recordSuccess(key);
    if (user.mfaEnabled) return this.beginMfaLogin(user, context);

    const session = await this.issueSession(user, context);
    void this.repository.touchLogin(user.id);
    this.audit({ identifier, userId: user.id, success: true, context });
    return session;
  }

  public async socialLogin(
    provider: SocialProvider,
    input: GoogleLoginDto | AppleLoginDto,
    context: AuthRequestContext,
  ): Promise<AuthSessionView> {
    const token = 'idToken' in input ? input.idToken : input.identityToken;
    const key = subjectRateLimitKey(
      `social:${provider}`,
      this.tokens.hashOpaqueToken(token),
      context.deviceFingerprint,
    );
    await this.assertHuman(input.captchaToken, `social:${provider}`, key);
    await this.consumeLimit(key, 10, 15 * 60);
    const verified = await this.socialVerifier.verify(provider, token);
    if (!verified) {
      throw new NotImplementedException(
        `${provider} token verification is not configured`,
      );
    }
    let user = await this.repository.findUserBySocialIdentity(
      provider,
      verified.providerUserId,
    );
    const isNewUser = !user;
    user ??= await this.repository.createSocialUser({
      provider,
      providerUserId: verified.providerUserId,
      email: verified.email,
      firstName: verified.firstName,
      lastName: verified.lastName,
      rawProfile: verified.rawProfile,
      role: input.role,
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }
    const session = await this.issueSession(user, context);
    return { ...session, isNewUser };
  }

  public requestSignupOtp(
    identifier: string,
    captchaToken: string | undefined,
    context: AuthRequestContext,
  ): Promise<{ success: true; masked: string; retryAfterSeconds: number }> {
    return this.requestOtp(identifier, 'SIGNUP', captchaToken, context, false);
  }

  public resendSignupOtp(
    identifier: string,
    captchaToken: string | undefined,
    context: AuthRequestContext,
  ): Promise<{ success: true; masked: string; retryAfterSeconds: number }> {
    return this.requestOtp(identifier, 'SIGNUP', captchaToken, context, true);
  }

  public forgotPassword(
    identifier: string,
    captchaToken: string | undefined,
    context: AuthRequestContext,
  ): Promise<{
    success: true;
    channel: 'EMAIL' | 'SMS';
    masked: string;
    retryAfterSeconds: number;
  }> {
    return this.requestOtp(
      identifier,
      'RESET_PASSWORD',
      captchaToken,
      context,
      false,
    ).then((result) => ({
      ...result,
      channel:
        normalizeIdentifier(identifier).kind === 'email' ? 'EMAIL' : 'SMS',
    }));
  }

  public resendResetOtp(
    identifier: string,
    captchaToken: string | undefined,
    context: AuthRequestContext,
  ): Promise<{ success: true; masked: string; retryAfterSeconds: number }> {
    return this.requestOtp(
      identifier,
      'RESET_PASSWORD',
      captchaToken,
      context,
      true,
    );
  }

  public async verifySignupOtp(
    identifier: string,
    otp: string,
  ): Promise<{
    success: true;
    signupToken: string;
    verifiedPhone?: string;
    verifiedEmail?: string;
  }> {
    const normalized = normalizeIdentifier(identifier);
    const challenge = await this.verifyOtp(
      normalized.value,
      'SIGNUP',
      otp,
      false,
    );
    const signupToken = this.tokens.randomOpaqueToken();
    await this.repository.updateOtp(challenge.id, {
      verifiedAt: new Date(),
      signupTokenHash: this.tokens.hashOpaqueToken(signupToken),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    });
    return {
      success: true,
      signupToken,
      ...(normalized.kind === 'phone'
        ? { verifiedPhone: normalized.value }
        : { verifiedEmail: normalized.value }),
    };
  }

  public async verifyResetOtp(
    identifier: string,
    otp: string,
  ): Promise<{ success: true }> {
    const normalized = normalizeIdentifier(identifier);
    const challenge = await this.verifyOtp(
      normalized.value,
      'RESET_PASSWORD',
      otp,
      false,
    );
    await this.repository.updateOtp(challenge.id, { verifiedAt: new Date() });
    return { success: true };
  }

  public async resetPassword(
    identifier: string,
    otp: string,
    newPassword: string,
  ): Promise<{ success: true }> {
    const normalized = normalizeIdentifier(identifier);
    const challenge = await this.repository.findLatestOtp(
      normalized.value,
      'RESET_PASSWORD',
    );
    if (
      !challenge ||
      !challenge.verifiedAt ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date() ||
      !this.otpMatches(otp, challenge.codeHash)
    ) {
      throw new UnauthorizedException('Invalid or expired reset code');
    }
    const user = await this.repository.findUserByIdentifier(normalized.value);
    if (!user) throw new UnauthorizedException('Invalid or expired reset code');
    const passwordHash = await this.passwords.hash(newPassword);
    await this.repository.updatePassword(user.id, passwordHash);
    await this.repository.updateOtp(challenge.id, { consumedAt: new Date() });
    return { success: true };
  }

  public async register(
    input: RegisterDto,
    context: AuthRequestContext,
  ): Promise<AuthSessionView> {
    if (input.password !== input.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }
    if (!input.email && !input.phone) {
      throw new BadRequestException('Email or phone is required');
    }
    const identifier = input.email
      ? normalizeEmail(input.email)
      : normalizeKenyanPhone(input.phone!);
    const existing = await this.repository.findUserByIdentifier(identifier);
    if (existing) throw new ConflictException('Account already exists');

    const consumed = await this.repository.consumeSignupToken(
      identifier,
      this.tokens.hashOpaqueToken(input.signupToken),
    );
    if (!consumed) throw new UnauthorizedException('Invalid signup token');

    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.repository.createLocalUser({
      email: input.email ? normalizeEmail(input.email) : undefined,
      phone: input.phone ? normalizeKenyanPhone(input.phone) : undefined,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      displayName: `${input.firstName.trim()} ${input.lastName.trim()}`,
      passwordHash,
      termsVersion: input.legalAcceptance.termsVersion,
      privacyVersion: input.legalAcceptance.privacyVersion,
      signatureName: input.legalAcceptance.signatureName,
    });
    return this.issueSession(user, context);
  }

  public async refresh(
    sessionId: string,
    refreshToken: string,
  ): Promise<{
    success: true;
    token: string;
    refreshToken: string;
    sessionId: string;
    expiresAt: string;
  }> {
    const session = await this.repository.findSession(sessionId);
    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (session.absoluteExpiresAt <= new Date()) {
      await this.repository.revokeSession(session.id);
      throw new UnauthorizedException('Session expired');
    }

    const matchesCurrent = this.tokens.tokenMatches(
      refreshToken,
      session.refreshTokenHash,
    );
    if (!matchesCurrent) {
      // Reuse of a rotated token → revoke the whole chain (theft signal).
      if (
        session.previousRefreshTokenHash &&
        this.tokens.tokenMatches(
          refreshToken,
          session.previousRefreshTokenHash,
        )
      ) {
        await this.repository.revokeSession(session.id);
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.repository.findUserById(session.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const nextRefresh = this.tokens.randomOpaqueToken();
    const slidingExpiresAt = new Date(
      Date.now() + this.config.refreshTtlSeconds * 1000,
    );
    const refreshExpiresAt =
      slidingExpiresAt < session.absoluteExpiresAt
        ? slidingExpiresAt
        : session.absoluteExpiresAt;
    await this.repository.rotateSession(
      session.id,
      this.tokens.hashOpaqueToken(nextRefresh),
      session.refreshTokenHash,
      refreshExpiresAt,
    );
    const principal = this.principal(user, session.id);
    const access = await this.tokens.issueAccessToken(principal);
    return {
      success: true,
      token: access.token,
      refreshToken: nextRefresh,
      sessionId: session.id,
      expiresAt: access.expiresAt.toISOString(),
    };
  }

  public async logout(sessionId: string): Promise<{ success: true }> {
    await this.repository.revokeSession(sessionId);
    return { success: true };
  }

  public async listDevices(
    userId: string,
    currentSessionId: string,
  ): Promise<{ success: true; devices: readonly IdentityDeviceSessionView[] }> {
    const devices = await this.repository.listActiveSessions(
      userId,
      currentSessionId,
    );
    return { success: true, devices };
  }

  public async revokeDevice(
    userId: string,
    sessionId: string,
    currentSessionId: string,
  ): Promise<{ success: true }> {
    const session = await this.repository.findSession(sessionId);
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Device session not found');
    }
    await this.repository.revokeSession(sessionId);
    if (sessionId === currentSessionId) {
      return { success: true };
    }
    return { success: true };
  }

  public async revokeOtherDevices(
    userId: string,
    currentSessionId: string,
  ): Promise<{ success: true; revoked: number }> {
    const revoked = await this.repository.revokeAllSessions(
      userId,
      currentSessionId,
    );
    return { success: true, revoked };
  }

  public async updatePhone(
    userId: string,
    phone: string,
  ): Promise<{ success: true }> {
    await this.repository.updateUserPhone(userId, normalizeKenyanPhone(phone));
    return { success: true };
  }

  public async legalAcceptances(userId: string): Promise<{
    acceptances: readonly {
      id: string;
      documentType: string;
      version: string;
      fullName: string | null;
      signatureName: string | null;
      acceptedAt: Date;
    }[];
  }> {
    return {
      acceptances: await this.repository.listLegalAcceptances(userId),
    };
  }

  public async verifyMfaLogin(
    challengeId: string,
    code: string,
    context: AuthRequestContext,
  ): Promise<AuthSessionView> {
    const totpChallenge =
      await this.repository.findMfaLoginChallenge(challengeId);
    if (totpChallenge) {
      if (
        totpChallenge.consumedAt ||
        totpChallenge.expiresAt <= new Date() ||
        totpChallenge.attempts >= totpChallenge.maxAttempts
      ) {
        throw new UnauthorizedException('Invalid MFA challenge');
      }
      const factor = await this.repository.findMfaFactor(
        totpChallenge.factorId,
        totpChallenge.userId,
      );
      if (!factor || !(await this.verifyFactor(factor, code))) {
        await this.repository.failMfaLoginChallenge(
          totpChallenge.id,
          totpChallenge.attempts + 1,
        );
        throw new UnauthorizedException('Invalid MFA code');
      }
      const consumed = await this.repository.consumeMfaLoginChallenge(
        totpChallenge.id,
      );
      if (!consumed) throw new UnauthorizedException('Invalid MFA challenge');
      await this.repository.touchMfaFactor(factor.id);
      const user = await this.repository.findUserById(totpChallenge.userId);
      if (!user) throw new UnauthorizedException('Invalid MFA challenge');
      return this.issueSession(user, context);
    }

    const otp = await this.repository.findOtpById(challengeId);
    if (!otp || otp.purpose !== 'LOGIN' || !otp.userId) {
      throw new UnauthorizedException('Invalid MFA challenge');
    }
    await this.verifyOtpRecord(otp, code, true);
    const user = await this.repository.findUserById(otp.userId);
    if (!user) throw new UnauthorizedException('Invalid MFA challenge');
    return this.issueSession(user, context);
  }

  public async resendMfaLogin(
    challengeId: string,
    context: AuthRequestContext,
  ): Promise<{
    success: true;
    mfaChallengeId: string;
    masked: string;
    retryAfterSeconds: number;
  }> {
    const previous = await this.repository.findOtpById(challengeId);
    if (
      !previous ||
      previous.purpose !== 'LOGIN' ||
      !previous.userId ||
      previous.consumedAt
    ) {
      throw new UnauthorizedException('Invalid MFA challenge');
    }
    const availableAt =
      previous.createdAt.getTime() +
      this.config.otpResendCooldownSeconds * 1000;
    if (availableAt > Date.now()) {
      throw new HttpException(
        {
          success: false,
          error: 'OTP_RESEND_COOLDOWN',
          message: 'Please wait before requesting another code',
          retryAfterSeconds: Math.ceil((availableAt - Date.now()) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const key = subjectRateLimitKey(
      'otp:LOGIN',
      previous.identifier,
      context.deviceFingerprint,
    );
    await this.consumeLimit(
      key,
      this.config.otpSendsPerWindow,
      this.config.otpSendWindowSeconds,
    );
    const next = await this.createOtp(
      previous.identifier,
      'LOGIN',
      previous.userId,
      previous.resendCount + 1,
    );
    return {
      success: true,
      mfaChallengeId: next.id,
      masked: maskIdentifier(
        previous.identifier,
        previous.channel === 'EMAIL' ? 'email' : 'phone',
      ),
      retryAfterSeconds: this.config.otpResendCooldownSeconds,
    };
  }

  public async enrollTotp(
    userId: string,
    label?: string,
  ): Promise<{
    success: true;
    factorId: string;
    secret: string;
    otpauthUri: string;
    qrCodeDataUrl: string;
  }> {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new UnauthorizedException();
    const secret = generateSecret();
    const accountLabel = user.email ?? user.phoneE164 ?? user.id;
    const uri = generateURI({
      issuer: this.config.totpIssuer,
      label: accountLabel,
      secret,
    });
    const factor = await this.repository.createTotpFactor({
      userId,
      label,
      secretEncrypted: this.encryption.encryptPayload(secret),
    });
    return {
      success: true,
      factorId: factor.id,
      secret,
      otpauthUri: uri,
      qrCodeDataUrl: await toDataURL(uri),
    };
  }

  public async verifyTotpEnrollment(
    userId: string,
    factorId: string,
    code: string,
  ): Promise<{ success: true; recoveryCodes: readonly string[] }> {
    const factor = await this.repository.findMfaFactor(factorId, userId);
    if (
      !factor ||
      factor.status !== 'PENDING' ||
      !(await this.verifyFactor(factor, code))
    ) {
      throw new UnauthorizedException('Invalid TOTP code');
    }
    const recoveryCodes = Array.from({ length: 10 }, () =>
      this.tokens.randomOpaqueToken(9),
    );
    await this.repository.activateMfaFactor(
      factor.id,
      userId,
      recoveryCodes.map((value) => this.tokens.hashOpaqueToken(value)),
    );
    return { success: true, recoveryCodes };
  }

  public async disableMfa(
    userId: string,
    code: string,
  ): Promise<{ success: true }> {
    const factor = await this.repository.findActiveMfaFactor(userId, 'TOTP');
    const factorValid = factor ? await this.verifyFactor(factor, code) : false;
    const recoveryValid = factorValid
      ? false
      : await this.repository.consumeRecoveryCode(
          userId,
          this.tokens.hashOpaqueToken(code),
        );
    if (!factorValid && !recoveryValid) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    await this.repository.disableMfa(userId);
    return { success: true };
  }

  private async beginMfaLogin(
    user: IdentityUserRecord,
    context: AuthRequestContext,
  ): Promise<MfaRequiredView> {
    const method = user.preferredMfaMethod;
    if (!method) throw new UnauthorizedException('MFA configuration invalid');
    const factor = await this.repository.findActiveMfaFactor(user.id, method);
    if (!factor) throw new UnauthorizedException('MFA configuration invalid');
    if (method === 'TOTP') {
      const challenge = await this.repository.createMfaLoginChallenge(
        user.id,
        factor.id,
        new Date(Date.now() + this.config.otpTtlSeconds * 1000),
        this.config.otpMaxAttempts,
      );
      return {
        success: true,
        mfaRequired: true,
        mfaChallengeId: challenge.id,
        method,
      };
    }
    const identifier = factor.deliveryIdentifier;
    if (!identifier)
      throw new UnauthorizedException('MFA configuration invalid');
    const challenge = await this.createOtp(identifier, 'LOGIN', user.id, 0);
    return {
      success: true,
      mfaRequired: true,
      mfaChallengeId: challenge.id,
      method,
      masked: maskIdentifier(
        identifier,
        method === 'EMAIL' ? 'email' : 'phone',
      ),
    };
  }

  private async requestOtp(
    rawIdentifier: string,
    purpose: Extract<AuthOtpPurpose, 'SIGNUP' | 'RESET_PASSWORD'>,
    captchaToken: string | undefined,
    context: AuthRequestContext,
    resend: boolean,
  ): Promise<{ success: true; masked: string; retryAfterSeconds: number }> {
    const normalized = normalizeIdentifier(rawIdentifier);
    const key = subjectRateLimitKey(
      `otp:${purpose}`,
      normalized.value,
      context.deviceFingerprint,
    );
    await this.assertHuman(captchaToken, `otp:${purpose}`, key);
    await this.consumeLimit(
      key,
      this.config.otpSendsPerWindow,
      this.config.otpSendWindowSeconds,
    );
    const latest = await this.repository.findLatestOtp(
      normalized.value,
      purpose,
    );
    if (latest && !latest.consumedAt) {
      const availableAt =
        latest.createdAt.getTime() +
        this.config.otpResendCooldownSeconds * 1000;
      if (availableAt > Date.now()) {
        throw new HttpException(
          {
            success: false,
            error: 'OTP_RESEND_COOLDOWN',
            message: 'Please wait before requesting another code',
            retryAfterSeconds: Math.ceil((availableAt - Date.now()) / 1000),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    if (resend && !latest) {
      throw new BadRequestException('No OTP request to resend');
    }

    let userId: string | undefined;
    if (purpose === 'RESET_PASSWORD') {
      const user = await this.repository.findUserByIdentifier(normalized.value);
      // Enumeration-safe response: do not enqueue a real message for unknown users.
      if (!user) {
        return {
          success: true,
          masked: maskIdentifier(normalized.value, normalized.kind),
          retryAfterSeconds: this.config.otpResendCooldownSeconds,
        };
      }
      userId = user.id;
    } else {
      const existing = await this.repository.findUserByIdentifier(
        normalized.value,
      );
      if (existing) throw new ConflictException('Account already exists');
    }

    await this.createOtp(
      normalized.value,
      purpose,
      userId,
      latest ? latest.resendCount + 1 : 0,
    );
    return {
      success: true,
      masked: maskIdentifier(normalized.value, normalized.kind),
      retryAfterSeconds: this.config.otpResendCooldownSeconds,
    };
  }

  private async createOtp(
    identifier: string,
    purpose: AuthOtpPurpose,
    userId: string | undefined,
    resendCount: number,
  ): Promise<IdentityOtpRecord> {
    const channel = identifier.includes('@') ? 'EMAIL' : 'SMS';
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const challenge = await this.repository.createOtp({
      userId,
      identifier,
      channel,
      purpose,
      codeHash: this.hashOtp(code),
      expiresAt: new Date(Date.now() + this.config.otpTtlSeconds * 1000),
      maxAttempts: this.config.otpMaxAttempts,
      resendCount,
    });
    const jobId = await this.jobs.dispatch({
      kind: 'deliver-otp',
      challengeId: challenge.id,
      identifier,
      channel,
      purpose,
      code,
    });
    await this.repository.updateOtp(challenge.id, { deliveryJobId: jobId });
    return challenge;
  }

  private async verifyOtp(
    identifier: string,
    purpose: AuthOtpPurpose,
    code: string,
    consume: boolean,
  ): Promise<IdentityOtpRecord> {
    const challenge = await this.repository.findLatestOtp(identifier, purpose);
    if (!challenge) throw new UnauthorizedException('Invalid or expired OTP');
    await this.verifyOtpRecord(challenge, code, consume);
    return challenge;
  }

  private async verifyOtpRecord(
    challenge: IdentityOtpRecord,
    code: string,
    consume: boolean,
  ): Promise<void> {
    if (
      challenge.consumedAt ||
      challenge.expiresAt <= new Date() ||
      challenge.attempts >= challenge.maxAttempts
    ) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    if (!this.otpMatches(code, challenge.codeHash)) {
      await this.repository.updateOtp(challenge.id, {
        attempts: challenge.attempts + 1,
      });
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    await this.repository.updateOtp(challenge.id, {
      verifiedAt: new Date(),
      ...(consume ? { consumedAt: new Date() } : {}),
    });
  }

  private async issueSession(
    user: IdentityUserRecord,
    context: AuthRequestContext,
  ): Promise<AuthSessionView> {
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }
    const sessionId = randomUUID();
    const refreshToken = this.tokens.randomOpaqueToken();
    const refreshExpiresAt = new Date(
      Date.now() + this.config.refreshTtlSeconds * 1000,
    );
    const absoluteExpiresAt = new Date(
      Date.now() + this.config.sessionAbsoluteTtlSeconds * 1000,
    );
    const principal = this.principal(user, sessionId);
    await this.repository.createSession({
      id: sessionId,
      userId: user.id,
      deviceFingerprint: context.deviceFingerprint,
      refreshTokenHash: this.tokens.hashOpaqueToken(refreshToken),
      roles: principal.roles,
      expiresAt: refreshExpiresAt,
      absoluteExpiresAt,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    const access = await this.tokens.issueAccessToken(principal);
    return {
      success: true,
      token: access.token,
      refreshToken,
      sessionId,
      expiresAt: access.expiresAt.toISOString(),
      user: this.userView(user),
    };
  }

  private principal(
    user: IdentityUserRecord,
    sessionId: string,
  ): AuthPrincipalView {
    return {
      id: user.id,
      sessionId,
      roles: user.roles.map((role) => role.code),
      permissions: [...new Set(user.roles.flatMap((role) => role.permissions))],
    };
  }

  private userView(user: IdentityUserRecord): AuthUserView {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      surname: user.lastName,
      email: user.email,
      phone: user.phoneE164 ?? user.phone,
      profilePhoto: user.photoUrl,
    };
  }

  private async verifyFactor(
    factor: IdentityMfaFactorRecord,
    code: string,
  ): Promise<boolean> {
    if (factor.method !== 'TOTP' || !factor.secretEncrypted) return false;
    const secret = this.encryption.decryptPayload(factor.secretEncrypted);
    const result = await verify({
      secret,
      token: code,
      epochTolerance: 30,
    });
    return result.valid;
  }

  private hashOtp(code: string): string {
    return createHmac('sha256', this.config.jwtSecret)
      .update(code)
      .digest('hex');
  }

  private otpMatches(code: string, digest: string): boolean {
    const actual = Buffer.from(this.hashOtp(code), 'hex');
    const expected = Buffer.from(digest, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private async assertHuman(
    token: string | undefined,
    action: string,
    subjectKey: string,
  ): Promise<void> {
    const valid = await this.humanChallenge.verify({
      token,
      action,
      subjectKey,
    });
    if (!valid) {
      throw new UnauthorizedException('Human verification required');
    }
  }

  private async consumeLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    const result = await this.rateLimits.consume(
      key,
      limit,
      windowSeconds * 1000,
    );
    if (!result.allowed) {
      throw new HttpException(
        {
          success: false,
          error: 'RATE_LIMITED',
          message: 'Too many attempts',
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((result.resetAt - Date.now()) / 1000),
          ),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private audit(input: {
    readonly identifier: string;
    readonly userId?: string;
    readonly success: boolean;
    readonly failureReason?: string;
    readonly context: AuthRequestContext;
  }): void {
    void this.jobs
      .dispatch({
        kind: 'record-auth-audit',
        userId: input.userId,
        identifier: input.identifier,
        success: input.success,
        failureReason: input.failureReason,
        ipAddress: input.context.ipAddress,
        userAgent: input.context.userAgent,
        deviceFingerprint: input.context.deviceFingerprint,
        correlationId: input.context.correlationId,
      })
      .catch(() => undefined);
  }
}
