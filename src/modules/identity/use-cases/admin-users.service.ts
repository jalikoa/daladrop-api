import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { IDENTITY_REPOSITORY } from '../constants/auth.constants';
import type { AuthUserView } from '../domain/auth.contracts';
import type { IdentityRepository } from '../repositories/identity.repository';

@Injectable()
export class AdminUsersService {
  public constructor(
    @Inject(IDENTITY_REPOSITORY)
    private readonly repository: IdentityRepository,
  ) {}

  public async list(input: {
    readonly q?: string;
    readonly status?: string;
    readonly limit?: number;
    readonly offset?: number;
  }) {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);
    const result = await this.repository.listUsers({
      query: input.q?.trim() || undefined,
      status: input.status?.trim() || undefined,
      limit,
      offset,
    });
    return {
      success: true as const,
      total: result.total,
      limit,
      offset,
      users: result.users.map((user) => this.adminUserView(user)),
    };
  }

  public async get(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new NotFoundException('User not found');
    return { success: true as const, user: this.adminUserView(user) };
  }

  public async freeze(
    actorId: string,
    userId: string,
    reason?: string,
  ): Promise<{ success: true; user: ReturnType<AdminUsersService['adminUserView']> }> {
    return this.changeStatus(actorId, userId, 'SUSPENDED', reason ?? 'frozen');
  }

  public async restrict(
    actorId: string,
    userId: string,
    reason?: string,
  ): Promise<{ success: true; user: ReturnType<AdminUsersService['adminUserView']> }> {
    return this.changeStatus(
      actorId,
      userId,
      'RESTRICTED',
      reason ?? 'restricted',
    );
  }

  public async restore(
    actorId: string,
    userId: string,
    reason?: string,
  ): Promise<{ success: true; user: ReturnType<AdminUsersService['adminUserView']> }> {
    return this.changeStatus(actorId, userId, 'ACTIVE', reason ?? 'restored');
  }

  public async revokeSessions(userId: string): Promise<{
    success: true;
    revoked: number;
  }> {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new NotFoundException('User not found');
    const revoked = await this.repository.revokeAllSessions(userId);
    return { success: true, revoked };
  }

  private async changeStatus(
    actorId: string,
    userId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'RESTRICTED',
    reason: string,
  ) {
    if (actorId === userId && status !== 'ACTIVE') {
      throw new BadRequestException('Cannot freeze or restrict your own account');
    }
    const existing = await this.repository.findUserById(userId);
    if (!existing) throw new NotFoundException('User not found');
    const user = await this.repository.setUserStatus({
      userId,
      status,
      reason,
      changedBy: actorId,
    });
    return { success: true as const, user: this.adminUserView(user) };
  }

  private adminUserView(user: {
    readonly id: string;
    readonly email: string | null;
    readonly phone: string | null;
    readonly phoneE164: string | null;
    readonly firstName: string | null;
    readonly lastName: string | null;
    readonly photoUrl: string | null;
    readonly status: string;
    readonly roles: readonly { readonly code: string }[];
  }): AuthUserView & {
    status: string;
    roles: string[];
  } {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      surname: user.lastName,
      email: user.email,
      phone: user.phoneE164 ?? user.phone,
      profilePhoto: user.photoUrl,
      status: user.status,
      roles: user.roles.map((role) => role.code),
    };
  }
}
