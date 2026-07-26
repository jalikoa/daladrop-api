import { BadRequestException, Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { BroadcastNotificationDto } from '../dto/notifications.dto';
import { NotificationType } from '../domain/notification.types';

const MAX_BROADCAST_RECIPIENTS = 5_000;

@Injectable()
export class AdminNotificationsService {
  public constructor(private readonly prisma: PrismaService) {}

  public async broadcast(actorId: string, body: BroadcastNotificationDto) {
    const userIds = body.userIds?.length
      ? body.userIds
      : await this.activeUserIds();
    if (userIds.length === 0) {
      throw new BadRequestException('No recipients resolved for broadcast');
    }

    const type = body.type ?? NotificationType.BROADCAST;
    const created = await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        title: body.title,
        body: body.body,
        data: { broadcastBy: actorId },
      })),
    });

    return {
      success: true as const,
      recipients: created.count,
    };
  }

  private async activeUserIds(): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: { status: UserStatus.ACTIVE, deletedAt: null },
      select: { id: true },
      take: MAX_BROADCAST_RECIPIENTS,
    });
    return rows.map((row) => row.id);
  }
}
