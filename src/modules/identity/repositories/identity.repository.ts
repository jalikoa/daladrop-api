import type {
  AuthMfaMethod,
  AuthOtpChannel,
  AuthOtpPurpose,
} from '../domain/auth.contracts';

export interface IdentityRoleRecord {
  readonly code: string;
  readonly permissions: readonly string[];
}

export interface IdentityUserRecord {
  readonly id: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly phoneE164: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly displayName: string | null;
  readonly photoUrl: string | null;
  readonly status: string;
  readonly passwordHash: string | null;
  readonly mfaEnabled: boolean;
  readonly preferredMfaMethod: AuthMfaMethod | null;
  readonly roles: readonly IdentityRoleRecord[];
}

export interface IdentityOtpRecord {
  readonly id: string;
  readonly userId: string | null;
  readonly identifier: string;
  readonly channel: AuthOtpChannel;
  readonly purpose: AuthOtpPurpose;
  readonly codeHash: string;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly signupTokenHash: string | null;
  readonly expiresAt: Date;
  readonly verifiedAt: Date | null;
  readonly consumedAt: Date | null;
  readonly sentAt: Date | null;
  readonly resendCount: number;
  readonly deliveryJobId: string | null;
  readonly createdAt: Date;
}

export interface IdentitySessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly refreshTokenHash: string;
  readonly previousRefreshTokenHash: string | null;
  readonly rolesSnapshot: readonly string[];
  readonly expiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly revokedAt: Date | null;
}

export interface IdentityDeviceSessionView {
  readonly sessionId: string;
  readonly deviceId: string | null;
  readonly platform: string | null;
  readonly model: string | null;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly current: boolean;
}

export interface IdentityMfaFactorRecord {
  readonly id: string;
  readonly userId: string;
  readonly method: AuthMfaMethod;
  readonly status: 'PENDING' | 'ACTIVE' | 'DISABLED';
  readonly secretEncrypted: string | null;
  readonly deliveryIdentifier: string | null;
}

export interface IdentityMfaLoginChallengeRecord {
  readonly id: string;
  readonly userId: string;
  readonly factorId: string;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}

export interface CreateLocalUserInput {
  readonly email?: string;
  readonly phone?: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly termsVersion: string;
  readonly privacyVersion: string;
  readonly signatureName: string;
}

export interface IdentityRepository {
  findUserByIdentifier(identifier: string): Promise<IdentityUserRecord | null>;
  findUserById(userId: string): Promise<IdentityUserRecord | null>;
  findUserBySocialIdentity(
    provider: string,
    providerUserId: string,
  ): Promise<IdentityUserRecord | null>;
  createSocialUser(input: {
    readonly provider: string;
    readonly providerUserId: string;
    readonly email?: string;
    readonly firstName?: string;
    readonly lastName?: string;
    readonly rawProfile?: Readonly<Record<string, unknown>>;
    readonly role: string;
  }): Promise<IdentityUserRecord>;
  createLocalUser(input: CreateLocalUserInput): Promise<IdentityUserRecord>;

  createOtp(input: {
    readonly userId?: string;
    readonly identifier: string;
    readonly channel: AuthOtpChannel;
    readonly purpose: AuthOtpPurpose;
    readonly codeHash: string;
    readonly expiresAt: Date;
    readonly maxAttempts: number;
    readonly resendCount: number;
  }): Promise<IdentityOtpRecord>;
  findLatestOtp(
    identifier: string,
    purpose: AuthOtpPurpose,
  ): Promise<IdentityOtpRecord | null>;
  findOtpById(id: string): Promise<IdentityOtpRecord | null>;
  updateOtp(
    id: string,
    patch: {
      readonly attempts?: number;
      readonly signupTokenHash?: string;
      readonly verifiedAt?: Date;
      readonly consumedAt?: Date;
      readonly sentAt?: Date;
      readonly deliveryJobId?: string;
      readonly expiresAt?: Date;
    },
  ): Promise<void>;
  consumeSignupToken(
    identifier: string,
    signupTokenHash: string,
  ): Promise<boolean>;

  createSession(input: {
    readonly id: string;
    readonly userId: string;
    readonly deviceFingerprint: string;
    readonly refreshTokenHash: string;
    readonly roles: readonly string[];
    readonly expiresAt: Date;
    readonly absoluteExpiresAt: Date;
    readonly ipAddress?: string;
    readonly userAgent?: string;
  }): Promise<IdentitySessionRecord>;
  findSession(id: string): Promise<IdentitySessionRecord | null>;
  rotateSession(
    id: string,
    refreshTokenHash: string,
    previousRefreshTokenHash: string,
    expiresAt: Date,
  ): Promise<void>;
  revokeSession(id: string): Promise<void>;
  revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number>;
  listActiveSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<readonly IdentityDeviceSessionView[]>;
  touchLogin(userId: string): Promise<void>;
  updatePassword(
    userId: string,
    passwordHash: string,
    options?: { readonly retainSessionId?: string },
  ): Promise<void>;
  updateUserPhone(userId: string, phone: string): Promise<void>;
  updateUserProfile(
    userId: string,
    patch: {
      readonly firstName?: string;
      readonly lastName?: string;
      readonly phone?: string;
      readonly photoUrl?: string | null;
    },
  ): Promise<IdentityUserRecord>;
  softDeleteUser(userId: string, reason?: string): Promise<void>;
  setUserStatus(input: {
    readonly userId: string;
    readonly status: 'ACTIVE' | 'SUSPENDED' | 'RESTRICTED' | 'DELETED';
    readonly reason?: string | null;
    readonly changedBy: string;
  }): Promise<IdentityUserRecord>;
  listUsers(input: {
    readonly query?: string;
    readonly status?: string;
    readonly limit: number;
    readonly offset: number;
  }): Promise<{ readonly total: number; readonly users: readonly IdentityUserRecord[] }>;
  listLegalAcceptances(userId: string): Promise<
    readonly {
      id: string;
      documentType: string;
      version: string;
      fullName: string | null;
      signatureName: string | null;
      acceptedAt: Date;
    }[]
  >;

  createTotpFactor(input: {
    readonly userId: string;
    readonly label?: string;
    readonly secretEncrypted: string;
  }): Promise<IdentityMfaFactorRecord>;
  findMfaFactor(
    factorId: string,
    userId?: string,
  ): Promise<IdentityMfaFactorRecord | null>;
  findActiveMfaFactor(
    userId: string,
    method: AuthMfaMethod,
  ): Promise<IdentityMfaFactorRecord | null>;
  activateMfaFactor(
    factorId: string,
    userId: string,
    recoveryCodeHashes: readonly string[],
  ): Promise<void>;
  touchMfaFactor(factorId: string): Promise<void>;
  disableMfa(userId: string): Promise<void>;
  consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean>;
  createMfaLoginChallenge(
    userId: string,
    factorId: string,
    expiresAt: Date,
    maxAttempts: number,
  ): Promise<IdentityMfaLoginChallengeRecord>;
  findMfaLoginChallenge(
    id: string,
  ): Promise<IdentityMfaLoginChallengeRecord | null>;
  failMfaLoginChallenge(id: string, attempts: number): Promise<void>;
  consumeMfaLoginChallenge(id: string): Promise<boolean>;
}
