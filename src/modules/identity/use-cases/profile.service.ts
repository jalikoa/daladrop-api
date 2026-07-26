import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import {
  ImageValidationError,
  validateImageBuffer,
} from '../../../platform/media/image-validation';
import {
  STORAGE_PROVIDER,
  StorageService,
  type StorageProvider,
} from '../../../platform/storage';
import { PasswordService } from '../../../platform/security/password/password.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { normalizeKenyanPhone } from '../domain/auth-identity.util';
import type { AuthUserView } from '../domain/auth.contracts';
import { IDENTITY_REPOSITORY } from '../constants/auth.constants';
import {
  PROFILE_PHOTO_MAX_BYTES,
  PUBLIC_UPLOAD_FOLDERS,
  PUBLIC_UPLOAD_MAX_BYTES,
  contentTypeForImageFormat,
  isPublicMediaKey,
  type PublicUploadFolder,
} from '../constants/profile.constants';
import type { IdentityRepository } from '../repositories/identity.repository';
import type { UpdatePasswordDto, UpdateProfileDto } from '../dto/profile.dto';

@Injectable()
export class ProfileService {
  private readonly storage: StorageService;

  public constructor(
    @Inject(IDENTITY_REPOSITORY)
    private readonly repository: IdentityRepository,
    private readonly passwords: PasswordService,
    @Inject(STORAGE_PROVIDER)
    provider: StorageProvider,
    private readonly prisma: PrismaService,
  ) {
    this.storage = new StorageService(provider, {
      maxBytes: PUBLIC_UPLOAD_MAX_BYTES,
      allowedContentTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf',
      ],
    });
  }

  public async getMe(userId: string): Promise<{
    success: true;
    user: AuthUserView & { status: string };
  }> {
    const user = await this.requireActiveUser(userId);
    return {
      success: true,
      user: { ...this.toUserView(user), status: user.status },
    };
  }

  public async updateProfile(
    userId: string,
    input: UpdateProfileDto,
  ): Promise<{ success: true; user: AuthUserView }> {
    await this.requireActiveUser(userId);
    const lastName = input.lastName ?? input.surname;
    if (
      input.firstName === undefined &&
      lastName === undefined &&
      input.phone === undefined
    ) {
      throw new BadRequestException('No profile fields provided');
    }
    const updated = await this.repository.updateUserProfile(userId, {
      ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
      ...(lastName !== undefined ? { lastName: lastName.trim() } : {}),
      ...(input.phone !== undefined
        ? { phone: normalizeKenyanPhone(input.phone) }
        : {}),
    });
    return { success: true, user: this.toUserView(updated) };
  }

  public async updatePassword(
    userId: string,
    sessionId: string,
    input: UpdatePasswordDto,
  ): Promise<{ success: true; message: string }> {
    const user = await this.requireActiveUser(userId);
    if (!user.passwordHash) {
      throw new BadRequestException('Password login is not configured');
    }
    const matches = await this.passwords.verify(
      input.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (input.currentPassword === input.newPassword) {
      throw new BadRequestException(
        'New password must differ from the current password',
      );
    }
    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.repository.updatePassword(userId, passwordHash, {
      retainSessionId: sessionId,
    });
    return { success: true, message: 'Password updated' };
  }

  public async uploadPhoto(
    actorId: string,
    targetUserId: string,
    file: Express.Multer.File | undefined,
  ): Promise<{
    success: true;
    user: { profilePhoto: string };
    file: { publicUrl: string };
  }> {
    if (actorId !== targetUserId) {
      throw new ForbiddenException('Cannot update another user photo');
    }
    await this.requireActiveUser(actorId);
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    let format: 'jpeg' | 'png' | 'webp' | 'gif';
    try {
      format = validateImageBuffer(file.buffer, {
        maxBytes: PROFILE_PHOTO_MAX_BYTES,
        allowedFormats: ['jpeg', 'png', 'webp'],
      });
    } catch (error: unknown) {
      if (error instanceof ImageValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    const key = `profiles/${actorId}/${randomUUID()}.${format === 'jpeg' ? 'jpg' : format}`;
    const contentType = contentTypeForImageFormat(format);
    await this.storage.upload(key, file.buffer, { contentType });
    const publicUrl = await this.publicOrSignedUrl(key);
    const updated = await this.repository.updateUserProfile(actorId, {
      photoUrl: publicUrl,
    });
    return {
      success: true,
      user: { profilePhoto: updated.photoUrl! },
      file: { publicUrl },
    };
  }

  public async deleteMe(userId: string): Promise<{ success: true }> {
    await this.requireActiveUser(userId);
    await this.repository.softDeleteUser(userId, 'user_requested');
    return { success: true };
  }

  /**
   * GDPR-style profile data export (JSON). Document rendering belongs in
   * `src/platform/documents` — this endpoint returns structured data the
   * client or an admin export job can render.
   */
  public async exportMe(userId: string) {
    const user = await this.requireActiveUser(userId);
    const [places, favourites, savedItems, notifications, rides, orders] =
      await Promise.all([
        this.prisma.savedPlace.findMany({ where: { userId } }),
        this.prisma.menuFavourite.findMany({
          where: { userId },
          select: { menuItemId: true, createdAt: true },
        }),
        this.prisma.savedItem.findMany({ where: { userId } }),
        this.prisma.notification.findMany({
          where: { userId, deletedAt: null },
          take: 200,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.ride.findMany({
          where: { customerId: userId, deletedAt: null },
          take: 100,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            serviceType: true,
            status: true,
            fareAmount: true,
            currency: true,
            createdAt: true,
            completedAt: true,
          },
        }),
        this.prisma.order.findMany({
          where: { customerId: userId, deletedAt: null },
          take: 100,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            totalAmount: true,
            currency: true,
            createdAt: true,
          },
        }),
      ]);

    return {
      success: true as const,
      exportedAt: new Date().toISOString(),
      profile: this.toUserView(user),
      places,
      favourites,
      savedItems,
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        createdAt: n.createdAt,
        readAt: n.readAt,
      })),
      rides: rides.map((r) => ({
        ...r,
        fareAmount: Number(r.fareAmount),
      })),
      orders: orders.map((o) => ({
        ...o,
        totalAmount: Number(o.totalAmount),
      })),
    };
  }

  public async uploadPublic(
    userId: string,
    folderRaw: string | undefined,
    file: Express.Multer.File | undefined,
  ): Promise<{ file: { publicUrl: string; key: string } }> {
    await this.requireActiveUser(userId);
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    const folder = (folderRaw ?? 'public').trim().toLowerCase();
    if (!PUBLIC_UPLOAD_FOLDERS.includes(folder as PublicUploadFolder)) {
      throw new BadRequestException(
        `folder must be one of: ${PUBLIC_UPLOAD_FOLDERS.join(', ')}`,
      );
    }
    let format: 'jpeg' | 'png' | 'webp' | 'gif';
    try {
      format = validateImageBuffer(file.buffer, {
        maxBytes: PUBLIC_UPLOAD_MAX_BYTES,
        allowedFormats: ['jpeg', 'png', 'webp', 'gif'],
      });
    } catch (error: unknown) {
      if (error instanceof ImageValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    const key = `${folder}/${userId}/${randomUUID()}.${format === 'jpeg' ? 'jpg' : format}`;
    await this.storage.upload(key, file.buffer, {
      contentType: contentTypeForImageFormat(format),
    });
    const publicUrl = await this.publicOrSignedUrl(key);
    return { file: { publicUrl, key } };
  }

  public async resolveMediaUrl(key: string): Promise<string> {
    return this.publicOrSignedUrl(key);
  }

  private async publicOrSignedUrl(key: string): Promise<string> {
    if (isPublicMediaKey(key)) {
      const base =
        process.env.STORAGE_PUBLIC_BASE_URL ??
        `${process.env.PUBLIC_URL ?? ''}/v1/media`;
      return `${base.replace(/\/$/, '')}/${key
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`;
    }
    return this.storage.signedUrl(key, {
      expiresInSeconds: 60 * 60,
      operation: 'get',
    });
  }

  private async requireActiveUser(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user || user.status === 'DELETED') {
      throw new NotFoundException('User not found');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }
    return user;
  }

  private toUserView(user: {
    readonly id: string;
    readonly firstName: string | null;
    readonly lastName: string | null;
    readonly email: string | null;
    readonly phone: string | null;
    readonly phoneE164: string | null;
    readonly photoUrl: string | null;
  }): AuthUserView {
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
}
