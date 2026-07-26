import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InMemoryStorage } from '../../../platform/storage';
import { ProfileService } from '../use-cases/profile.service';
import { AdminUsersService } from '../use-cases/admin-users.service';
import type { IdentityRepository } from '../repositories/identity.repository';
import type { PasswordService } from '../../../platform/security/password/password.service';

const activeUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'user@example.com',
  phone: '0712345678',
  phoneE164: '254712345678',
  firstName: 'Test',
  lastName: 'User',
  displayName: 'Test User',
  photoUrl: null,
  status: 'ACTIVE',
  passwordHash: 'hash',
  mfaEnabled: false,
  preferredMfaMethod: null,
  roles: [{ code: 'CUSTOMER', permissions: [] }],
} as const;

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

const prisma = {
  savedPlace: { findMany: jest.fn().mockResolvedValue([]) },
  menuFavourite: { findMany: jest.fn().mockResolvedValue([]) },
  savedItem: { findMany: jest.fn().mockResolvedValue([]) },
  notification: { findMany: jest.fn().mockResolvedValue([]) },
  ride: { findMany: jest.fn().mockResolvedValue([]) },
  order: { findMany: jest.fn().mockResolvedValue([]) },
};

describe('ProfileService', () => {
  const previous = { ...process.env };

  beforeEach(() => {
    process.env.STORAGE_PUBLIC_BASE_URL = 'http://localhost:3000/v1/media';
    process.env.PUBLIC_URL = 'http://localhost:3000';
  });

  afterAll(() => {
    process.env = previous;
  });

  function setup() {
    const repository = mockRepository();
    const passwords = {
      verify: jest.fn(),
      hash: jest.fn(),
    } as unknown as jest.Mocked<PasswordService>;
    const storage = new InMemoryStorage();
    const service = new ProfileService(
      repository,
      passwords,
      storage,
      prisma as never,
    );
    repository.findUserById.mockResolvedValue({ ...activeUser });
    return { repository, passwords, storage, service };
  }

  it('hydrates GET /user/me and updates profile fields', async () => {
    const { service, repository } = setup();
    repository.updateUserProfile.mockResolvedValue({
      ...activeUser,
      firstName: 'Ada',
      lastName: 'Lovelace',
      phoneE164: '254700000000',
      phone: '254700000000',
    });

    await expect(service.getMe(activeUser.id)).resolves.toMatchObject({
      success: true,
      user: { firstName: 'Test', status: 'ACTIVE' },
    });

    await expect(
      service.updateProfile(activeUser.id, {
        firstName: 'Ada',
        surname: 'Lovelace',
        phone: '0700000000',
      }),
    ).resolves.toMatchObject({
      success: true,
      user: { firstName: 'Ada', lastName: 'Lovelace', surname: 'Lovelace' },
    });
    expect(repository.updateUserProfile).toHaveBeenCalledWith(
      activeUser.id,
      expect.objectContaining({
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '254700000000',
      }),
    );
  });

  it('rejects empty profile patches and inactive accounts', async () => {
    const { service, repository } = setup();
    await expect(
      service.updateProfile(activeUser.id, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    repository.findUserById.mockResolvedValueOnce({
      ...activeUser,
      status: 'SUSPENDED',
    });
    await expect(
      service.updateProfile(activeUser.id, { firstName: 'X' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('updates password while retaining the current session', async () => {
    const { service, repository, passwords } = setup();
    passwords.verify.mockResolvedValue(true);
    passwords.hash.mockResolvedValue('new-hash');
    await expect(
      service.updatePassword(activeUser.id, 'session-1', {
        currentPassword: 'OldPass123!@#x',
        newPassword: 'NewPass123!@#x',
      }),
    ).resolves.toEqual({ success: true, message: 'Password updated' });
    expect(repository.updatePassword).toHaveBeenCalledWith(
      activeUser.id,
      'new-hash',
      { retainSessionId: 'session-1' },
    );
  });

  it('rejects wrong current password and identical new password', async () => {
    const { service, passwords } = setup();
    passwords.verify.mockResolvedValue(false);
    await expect(
      service.updatePassword(activeUser.id, 's', {
        currentPassword: 'bad',
        newPassword: 'NewPass123!@#x',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    passwords.verify.mockResolvedValue(true);
    await expect(
      service.updatePassword(activeUser.id, 's', {
        currentPassword: 'SamePass123!@#',
        newPassword: 'SamePass123!@#',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uploads profile photos with magic-byte validation and ownership checks', async () => {
    const { service, repository } = setup();
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);
    repository.updateUserProfile.mockImplementation(async (_id, patch) => ({
      ...activeUser,
      photoUrl: patch.photoUrl ?? null,
    }));

    await expect(
      service.uploadPhoto(
        activeUser.id,
        '22222222-2222-4222-8222-222222222222',
        { buffer: png } as Express.Multer.File,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const result = await service.uploadPhoto(activeUser.id, activeUser.id, {
      buffer: png,
      originalname: 'a.png',
      mimetype: 'image/png',
    } as Express.Multer.File);
    expect(result.success).toBe(true);
    expect(result.user.profilePhoto).toContain('/v1/media/profiles/');
    expect(result.file.publicUrl).toBe(result.user.profilePhoto);

    await expect(
      service.uploadPhoto(activeUser.id, activeUser.id, {
        buffer: Buffer.from('not-an-image'),
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('soft-deletes the account and supports authenticated public uploads', async () => {
    const { service, repository } = setup();
    await expect(service.deleteMe(activeUser.id)).resolves.toEqual({
      success: true,
    });
    expect(repository.softDeleteUser).toHaveBeenCalled();

    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    const uploaded = await service.uploadPublic(
      activeUser.id,
      'age-verification',
      { buffer: png } as Express.Multer.File,
    );
    expect(uploaded.file.key.startsWith('age-verification/')).toBe(true);
    await expect(
      service.uploadPublic(activeUser.id, 'evil', {
        buffer: png,
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects password update when credential missing and surfaces not-found', async () => {
    const { service, repository } = setup();
    repository.findUserById.mockResolvedValueOnce({
      ...activeUser,
      passwordHash: null,
    });
    await expect(
      service.updatePassword(activeUser.id, 's', {
        currentPassword: 'x',
        newPassword: 'NewPass123!@#x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    repository.findUserById.mockResolvedValueOnce(null);
    await expect(service.getMe(activeUser.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.uploadPhoto(activeUser.id, activeUser.id, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.uploadPublic(activeUser.id, 'public', undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns signed URLs for private folders', async () => {
    const { service } = setup();
    const url = await service.resolveMediaUrl(
      `age-verification/${activeUser.id}/doc.png`,
    );
    expect(url).toMatch(/age-verification/);
    expect(url).toMatch(/expires|expiresIn/);
  });
});

describe('AdminUsersService', () => {
  function setup() {
    const repository = mockRepository();
    const service = new AdminUsersService(repository);
    return { repository, service };
  }

  it('lists users and freezes with session knock-out via setUserStatus', async () => {
    const { service, repository } = setup();
    repository.listUsers.mockResolvedValue({
      total: 1,
      users: [{ ...activeUser }],
    });
    repository.findUserById.mockResolvedValue({ ...activeUser });
    repository.setUserStatus.mockResolvedValue({
      ...activeUser,
      status: 'SUSPENDED',
    });

    await expect(service.list({ limit: 10 })).resolves.toMatchObject({
      success: true,
      total: 1,
      users: [{ id: activeUser.id, status: 'ACTIVE' }],
    });

    await expect(
      service.freeze('admin-id', activeUser.id, 'fraud'),
    ).resolves.toMatchObject({
      success: true,
      user: { status: 'SUSPENDED' },
    });
    expect(repository.setUserStatus).toHaveBeenCalledWith({
      userId: activeUser.id,
      status: 'SUSPENDED',
      reason: 'fraud',
      changedBy: 'admin-id',
    });
  });

  it('restricts, restores, and blocks self-freeze', async () => {
    const { service, repository } = setup();
    repository.findUserById.mockResolvedValue({ ...activeUser });
    repository.setUserStatus.mockResolvedValue({
      ...activeUser,
      status: 'RESTRICTED',
    });
    await expect(
      service.restrict('admin-id', activeUser.id, 'abuse'),
    ).resolves.toMatchObject({ user: { status: 'RESTRICTED' } });

    repository.setUserStatus.mockResolvedValue({
      ...activeUser,
      status: 'ACTIVE',
    });
    await expect(
      service.restore('admin-id', activeUser.id),
    ).resolves.toMatchObject({ user: { status: 'ACTIVE' } });

    await expect(
      service.freeze(activeUser.id, activeUser.id, 'nope'),
    ).rejects.toBeInstanceOf(BadRequestException);

    repository.findUserById.mockResolvedValueOnce(null);
    await expect(service.get('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('revokes all sessions for an account', async () => {
    const { service, repository } = setup();
    repository.findUserById.mockResolvedValue({ ...activeUser });
    repository.revokeAllSessions.mockResolvedValue(3);
    await expect(service.revokeSessions(activeUser.id)).resolves.toEqual({
      success: true,
      revoked: 3,
    });
  });
});
