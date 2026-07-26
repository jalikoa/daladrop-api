import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';

export interface RegisterPushTokenInput {
  readonly userId: string;
  readonly token: string;
  readonly platform: string;
}

export interface UnregisterPushTokenInput {
  readonly userId: string;
  readonly token?: string;
}

@Injectable()
export class PushTokenService {
  public constructor(private readonly prisma: PrismaService) {}

  public async register(input: RegisterPushTokenInput) {
    const existing = await this.prisma.pushToken.findUnique({
      where: { userId_token: { userId: input.userId, token: input.token } },
    });
    if (existing) {
      const updated = await this.prisma.pushToken.update({
        where: { id: existing.id },
        data: { platform: input.platform, deletedAt: null },
      });
      return { success: true as const, id: updated.id };
    }
    const created = await this.prisma.pushToken.create({
      data: {
        userId: input.userId,
        token: input.token,
        platform: input.platform,
      },
    });
    return { success: true as const, id: created.id };
  }

  public async unregister(input: UnregisterPushTokenInput) {
    await this.prisma.pushToken.updateMany({
      where: {
        userId: input.userId,
        deletedAt: null,
        ...(input.token ? { token: input.token } : {}),
      },
      data: { deletedAt: new Date() },
    });
    return { success: true as const };
  }
}
