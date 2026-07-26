import { Injectable } from '@nestjs/common';
import {
  MfaFactorStatus,
  MfaMethod,
  OtpChannel,
  OtpPurpose,
  Prisma,
  RoleCode,
} from '@prisma/client';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import type {
  CreateLocalUserInput,
  IdentityDeviceSessionView,
  IdentityMfaFactorRecord,
  IdentityMfaLoginChallengeRecord,
  IdentityOtpRecord,
  IdentityRepository,
  IdentitySessionRecord,
  IdentityUserRecord,
} from '../identity.repository';

const userInclude = {
  credential: true,
  securitySettings: true,
  roles: {
    where: {
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithAuth = Prisma.UserGetPayload<{ include: typeof userInclude }>;

@Injectable()
export class PrismaIdentityRepository implements IdentityRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async findUserByIdentifier(
    identifier: string,
  ): Promise<IdentityUserRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { email: { equals: identifier, mode: 'insensitive' } },
          { phoneE164: identifier },
        ],
      },
      include: userInclude,
    });
    return user ? this.mapUser(user) : null;
  }

  public async findUserById(
    userId: string,
  ): Promise<IdentityUserRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: userInclude,
    });
    return user ? this.mapUser(user) : null;
  }

  public async findUserBySocialIdentity(
    provider: string,
    providerUserId: string,
  ): Promise<IdentityUserRecord | null> {
    const identity = await this.prisma.socialIdentity.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
      include: { user: { include: userInclude } },
    });
    return identity ? this.mapUser(identity.user) : null;
  }

  public async createSocialUser(input: {
    readonly provider: string;
    readonly providerUserId: string;
    readonly email?: string;
    readonly firstName?: string;
    readonly lastName?: string;
    readonly rawProfile?: Readonly<Record<string, unknown>>;
    readonly role: string;
  }): Promise<IdentityUserRecord> {
    return this.prisma.$transaction(async (tx) => {
      const roleCode = this.roleCode(input.role);
      const role = await tx.role.upsert({
        where: { code: roleCode },
        update: {},
        create: { code: roleCode, name: this.roleName(roleCode) },
      });
      const user = await tx.user.create({
        data: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          displayName: [input.firstName, input.lastName]
            .filter(Boolean)
            .join(' '),
          status: 'ACTIVE',
          emailVerifiedAt: input.email ? new Date() : undefined,
          socialIdentities: {
            create: {
              provider: input.provider,
              providerUserId: input.providerUserId,
              email: input.email,
              rawProfile: input.rawProfile as Prisma.InputJsonValue | undefined,
            },
          },
          securitySettings: { create: {} },
          roles: { create: { roleId: role.id } },
        },
        include: userInclude,
      });
      return this.mapUser(user);
    });
  }

  public async createLocalUser(
    input: CreateLocalUserInput,
  ): Promise<IdentityUserRecord> {
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.upsert({
        where: { code: RoleCode.CUSTOMER },
        update: {},
        create: { code: RoleCode.CUSTOMER, name: 'Customer' },
      });
      const user = await tx.user.create({
        data: {
          email: input.email,
          phone: input.phone,
          phoneE164: input.phone,
          firstName: input.firstName,
          lastName: input.lastName,
          displayName: input.displayName,
          status: 'ACTIVE',
          emailVerifiedAt: input.email ? new Date() : undefined,
          phoneVerifiedAt: input.phone ? new Date() : undefined,
          credential: {
            create: { passwordHash: input.passwordHash },
          },
          securitySettings: { create: {} },
          roles: { create: { roleId: role.id } },
          legalAcceptances: {
            create: [
              {
                documentType: 'TERMS',
                version: input.termsVersion,
                fullName: input.displayName,
                signatureName: input.signatureName,
              },
              {
                documentType: 'PRIVACY',
                version: input.privacyVersion,
                fullName: input.displayName,
                signatureName: input.signatureName,
              },
            ],
          },
        },
        include: userInclude,
      });
      return this.mapUser(user);
    });
  }

  public async createOtp(input: {
    readonly userId?: string;
    readonly identifier: string;
    readonly channel: 'EMAIL' | 'SMS';
    readonly purpose:
      'SIGNUP' | 'LOGIN' | 'RESET_PASSWORD' | 'VERIFY_PHONE' | 'VERIFY_EMAIL';
    readonly codeHash: string;
    readonly expiresAt: Date;
    readonly maxAttempts: number;
    readonly resendCount: number;
  }): Promise<IdentityOtpRecord> {
    const otp = await this.prisma.otpChallenge.create({
      data: {
        userId: input.userId,
        identifier: input.identifier,
        channel: input.channel as OtpChannel,
        purpose: input.purpose as OtpPurpose,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        maxAttempts: input.maxAttempts,
        resendCount: input.resendCount,
      },
    });
    return this.mapOtp(otp);
  }

  public async findLatestOtp(
    identifier: string,
    purpose: OtpPurpose,
  ): Promise<IdentityOtpRecord | null> {
    const otp = await this.prisma.otpChallenge.findFirst({
      where: { identifier, purpose },
      orderBy: { createdAt: 'desc' },
    });
    return otp ? this.mapOtp(otp) : null;
  }

  public async findOtpById(id: string): Promise<IdentityOtpRecord | null> {
    const otp = await this.prisma.otpChallenge.findUnique({ where: { id } });
    return otp ? this.mapOtp(otp) : null;
  }

  public async updateOtp(
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
  ): Promise<void> {
    await this.prisma.otpChallenge.update({ where: { id }, data: patch });
  }

  public async consumeSignupToken(
    identifier: string,
    signupTokenHash: string,
  ): Promise<boolean> {
    const result = await this.prisma.otpChallenge.updateMany({
      where: {
        identifier,
        purpose: OtpPurpose.SIGNUP,
        signupTokenHash,
        verifiedAt: { not: null },
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    return result.count === 1;
  }

  public async createSession(input: {
    readonly id: string;
    readonly userId: string;
    readonly deviceFingerprint: string;
    readonly refreshTokenHash: string;
    readonly roles: readonly string[];
    readonly expiresAt: Date;
    readonly absoluteExpiresAt: Date;
    readonly ipAddress?: string;
    readonly userAgent?: string;
  }): Promise<IdentitySessionRecord> {
    const device = await this.prisma.device.upsert({
      where: {
        userId_fingerprint: {
          userId: input.userId,
          fingerprint: input.deviceFingerprint,
        },
      },
      update: { lastSeenAt: new Date(), deletedAt: null },
      create: {
        userId: input.userId,
        fingerprint: input.deviceFingerprint,
        lastSeenAt: new Date(),
      },
    });
    const session = await this.prisma.session.create({
      data: {
        id: input.id,
        userId: input.userId,
        deviceId: device.id,
        refreshTokenHash: input.refreshTokenHash,
        rolesSnapshot: [...input.roles],
        expiresAt: input.expiresAt,
        absoluteExpiresAt: input.absoluteExpiresAt,
        ip: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
    return this.mapSession(session);
  }

  public async findSession(id: string): Promise<IdentitySessionRecord | null> {
    const session = await this.prisma.session.findUnique({ where: { id } });
    return session ? this.mapSession(session) : null;
  }

  public async rotateSession(
    id: string,
    refreshTokenHash: string,
    previousRefreshTokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.session.update({
      where: { id },
      data: {
        refreshTokenHash,
        previousRefreshTokenHash,
        expiresAt,
      },
    });
  }

  public async revokeSession(id: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  public async revokeAllSessions(
    userId: string,
    exceptSessionId?: string,
  ): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  public async listActiveSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<readonly IdentityDeviceSessionView[]> {
    const now = new Date();
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      include: {
        device: {
          select: { id: true, platform: true, model: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return sessions.map((session) => ({
      sessionId: session.id,
      deviceId: session.device?.id ?? session.deviceId,
      platform: session.device?.platform ?? null,
      model: session.device?.model ?? null,
      ip: session.ip,
      userAgent: session.userAgent,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: currentSessionId === session.id,
    }));
  }

  public async touchLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  public async updatePassword(
    userId: string,
    passwordHash: string,
    options?: { readonly retainSessionId?: string },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.userCredential.findUnique({
        where: { userId },
      });
      if (current) {
        await tx.passwordHistory.create({
          data: { userId, passwordHash: current.passwordHash },
        });
      }
      await tx.userCredential.upsert({
        where: { userId },
        update: { passwordHash, passwordSetAt: new Date() },
        create: { userId, passwordHash },
      });
      await tx.session.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(options?.retainSessionId
            ? { id: { not: options.retainSessionId } }
            : {}),
        },
        data: { revokedAt: new Date() },
      });
    });
  }

  public async updateUserPhone(userId: string, phone: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        phone,
        phoneE164: phone,
        phoneVerifiedAt: null,
        version: { increment: 1 },
      },
    });
  }

  public async updateUserProfile(
    userId: string,
    patch: {
      readonly firstName?: string;
      readonly lastName?: string;
      readonly phone?: string;
      readonly photoUrl?: string | null;
    },
  ): Promise<IdentityUserRecord> {
    const data: Prisma.UserUpdateInput = {
      version: { increment: 1 },
    };
    if (patch.firstName !== undefined) data.firstName = patch.firstName;
    if (patch.lastName !== undefined) data.lastName = patch.lastName;
    if (patch.phone !== undefined) {
      data.phone = patch.phone;
      data.phoneE164 = patch.phone;
      data.phoneVerifiedAt = null;
    }
    if (patch.photoUrl !== undefined) data.photoUrl = patch.photoUrl;

    const existing = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
      select: { firstName: true, lastName: true },
    });
    const firstName = patch.firstName ?? existing.firstName;
    const lastName = patch.lastName ?? existing.lastName;
    data.displayName = [firstName, lastName].filter(Boolean).join(' ') || null;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: userInclude,
    });
    return this.mapUser(user);
  }

  public async softDeleteUser(userId: string, reason?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: 'DELETED',
          deletedAt: new Date(),
          deletedBy: userId,
          deleteReason: reason ?? 'user_requested',
          statusReason: reason ?? 'user_requested',
          statusChangedAt: new Date(),
          statusChangedBy: userId,
          version: { increment: 1 },
        },
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  public async setUserStatus(input: {
    readonly userId: string;
    readonly status: 'ACTIVE' | 'SUSPENDED' | 'RESTRICTED' | 'DELETED';
    readonly reason?: string | null;
    readonly changedBy: string;
  }): Promise<IdentityUserRecord> {
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: input.userId },
        data: {
          status: input.status,
          statusReason: input.reason ?? null,
          statusChangedAt: new Date(),
          statusChangedBy: input.changedBy,
          version: { increment: 1 },
          ...(input.status === 'DELETED'
            ? {
                deletedAt: new Date(),
                deletedBy: input.changedBy,
                deleteReason: input.reason ?? 'admin_deleted',
              }
            : {}),
          ...(input.status === 'ACTIVE'
            ? { deletedAt: null, deletedBy: null, deleteReason: null }
            : {}),
        },
        include: userInclude,
      });
      if (input.status !== 'ACTIVE') {
        await tx.session.updateMany({
          where: { userId: input.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return updated;
    });
    return this.mapUser(user);
  }

  public async listUsers(input: {
    readonly query?: string;
    readonly status?: string;
    readonly limit: number;
    readonly offset: number;
  }): Promise<{
    readonly total: number;
    readonly users: readonly IdentityUserRecord[];
  }> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(input.status
        ? { status: input.status as Prisma.EnumUserStatusFilter['equals'] }
        : {}),
      ...(input.query
        ? {
            OR: [
              { email: { contains: input.query, mode: 'insensitive' } },
              { phoneE164: { contains: input.query } },
              { firstName: { contains: input.query, mode: 'insensitive' } },
              { lastName: { contains: input.query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        skip: input.offset,
      }),
    ]);
    return { total, users: rows.map((row) => this.mapUser(row)) };
  }

  public listLegalAcceptances(userId: string) {
    return this.prisma.legalAcceptance.findMany({
      where: { userId },
      select: {
        id: true,
        documentType: true,
        version: true,
        fullName: true,
        signatureName: true,
        acceptedAt: true,
      },
      orderBy: { acceptedAt: 'desc' },
    });
  }

  public async createTotpFactor(input: {
    readonly userId: string;
    readonly label?: string;
    readonly secretEncrypted: string;
  }): Promise<IdentityMfaFactorRecord> {
    const factor = await this.prisma.mfaFactor.create({
      data: {
        userId: input.userId,
        method: MfaMethod.TOTP,
        label: input.label,
        secretEncrypted: input.secretEncrypted,
      },
    });
    return this.mapFactor(factor);
  }

  public async findMfaFactor(
    factorId: string,
    userId?: string,
  ): Promise<IdentityMfaFactorRecord | null> {
    const factor = await this.prisma.mfaFactor.findFirst({
      where: { id: factorId, ...(userId ? { userId } : {}) },
    });
    return factor ? this.mapFactor(factor) : null;
  }

  public async findActiveMfaFactor(
    userId: string,
    method: MfaMethod,
  ): Promise<IdentityMfaFactorRecord | null> {
    const factor = await this.prisma.mfaFactor.findFirst({
      where: { userId, method, status: MfaFactorStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });
    return factor ? this.mapFactor(factor) : null;
  }

  public async activateMfaFactor(
    factorId: string,
    userId: string,
    recoveryCodeHashes: readonly string[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const factor = await tx.mfaFactor.update({
        where: { id: factorId },
        data: { status: MfaFactorStatus.ACTIVE, verifiedAt: new Date() },
      });
      if (factor.userId !== userId)
        throw new Error('MFA factor ownership mismatch');
      await tx.mfaRecoveryCode.createMany({
        data: recoveryCodeHashes.map((codeHash) => ({
          factorId,
          codeHash,
        })),
      });
      await tx.userSecuritySettings.upsert({
        where: { userId },
        update: {
          mfaEnabled: true,
          preferredMfaMethod: factor.method,
          version: { increment: 1 },
        },
        create: {
          userId,
          mfaEnabled: true,
          preferredMfaMethod: factor.method,
        },
      });
    });
  }

  public async touchMfaFactor(factorId: string): Promise<void> {
    await this.prisma.mfaFactor.update({
      where: { id: factorId },
      data: { lastUsedAt: new Date() },
    });
  }

  public async disableMfa(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.mfaFactor.updateMany({
        where: { userId, status: MfaFactorStatus.ACTIVE },
        data: { status: MfaFactorStatus.DISABLED, disabledAt: new Date() },
      }),
      this.prisma.userSecuritySettings.upsert({
        where: { userId },
        update: {
          mfaEnabled: false,
          preferredMfaMethod: null,
          version: { increment: 1 },
        },
        create: { userId, mfaEnabled: false },
      }),
    ]);
  }

  public async consumeRecoveryCode(
    userId: string,
    codeHash: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const code = await tx.mfaRecoveryCode.findFirst({
        where: {
          codeHash,
          usedAt: null,
          factor: { userId, status: MfaFactorStatus.ACTIVE },
        },
      });
      if (!code) return false;
      const updated = await tx.mfaRecoveryCode.updateMany({
        where: { id: code.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      return updated.count === 1;
    });
  }

  public async createMfaLoginChallenge(
    userId: string,
    factorId: string,
    expiresAt: Date,
    maxAttempts: number,
  ): Promise<IdentityMfaLoginChallengeRecord> {
    return this.prisma.mfaLoginChallenge.create({
      data: { userId, factorId, expiresAt, maxAttempts },
    });
  }

  public findMfaLoginChallenge(
    id: string,
  ): Promise<IdentityMfaLoginChallengeRecord | null> {
    return this.prisma.mfaLoginChallenge.findUnique({ where: { id } });
  }

  public async failMfaLoginChallenge(
    id: string,
    attempts: number,
  ): Promise<void> {
    await this.prisma.mfaLoginChallenge.update({
      where: { id },
      data: { attempts },
    });
  }

  public async consumeMfaLoginChallenge(id: string): Promise<boolean> {
    const result = await this.prisma.mfaLoginChallenge.updateMany({
      where: {
        id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    return result.count === 1;
  }

  private mapUser(user: UserWithAuth): IdentityUserRecord {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      phoneE164: user.phoneE164,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
      status: user.status,
      passwordHash: user.credential?.passwordHash ?? null,
      mfaEnabled: user.securitySettings?.mfaEnabled ?? false,
      preferredMfaMethod:
        (user.securitySettings?.preferredMfaMethod as
          'TOTP' | 'EMAIL' | 'SMS' | null) ?? null,
      roles: user.roles.map(({ role }) => ({
        code: role.code,
        permissions: role.permissions.map(({ permission }) => permission.code),
      })),
    };
  }

  private mapOtp(
    otp: Prisma.OtpChallengeGetPayload<Record<string, never>>,
  ): IdentityOtpRecord {
    return {
      ...otp,
      channel: otp.channel,
      purpose: otp.purpose,
    };
  }

  private mapSession(
    session: Prisma.SessionGetPayload<Record<string, never>>,
  ): IdentitySessionRecord {
    return { ...session, rolesSnapshot: session.rolesSnapshot };
  }

  private mapFactor(
    factor: Prisma.MfaFactorGetPayload<Record<string, never>>,
  ): IdentityMfaFactorRecord {
    return {
      id: factor.id,
      userId: factor.userId,
      method: factor.method,
      status: factor.status,
      secretEncrypted: factor.secretEncrypted,
      deliveryIdentifier: factor.deliveryIdentifier,
    };
  }

  private roleCode(value: string): RoleCode {
    return Object.values(RoleCode).includes(value as RoleCode)
      ? (value as RoleCode)
      : RoleCode.CUSTOMER;
  }

  private roleName(value: RoleCode): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ');
  }
}
