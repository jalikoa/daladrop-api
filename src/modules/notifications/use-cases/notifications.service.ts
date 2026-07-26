import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Notification } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PaginationService } from '../../../platform/api/pagination/pagination.service';
import type {
  CreateInAppNotificationInput,
  NotificationView,
} from '../domain/notification.types';
import { NotificationPreferencesService } from './notification-preferences.service';
import { PushDeliveryService } from './push-delivery.service';

export interface ListNotificationsQuery {
  readonly page?: string;
  readonly limit?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly pagination = new PaginationService(20, 100);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly preferences: NotificationPreferencesService,
    private readonly pushDelivery: PushDeliveryService,
  ) {}

  public async list(userId: string, query: ListNotificationsQuery = {}) {
    const { page, limit } = this.pagination.normalizeOffset({
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 20,
    });
    const where = { userId, deletedAt: null };
    const [rows, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return {
      success: true as const,
      notifications: rows.map((row) => this.toView(row)),
      items: rows.map((row) => this.toView(row)),
      page,
      hasMore: (page - 1) * limit + rows.length < total,
      total,
      unreadCount: unread,
    };
  }

  public async get(userId: string, id: string) {
    const row = await this.requireOwned(userId, id);
    return { success: true as const, notification: this.toView(row) };
  }

  public async softDelete(userId: string, id: string) {
    await this.requireOwned(userId, id);
    await this.prisma.notification.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true as const };
  }

  public async markRead(userId: string, id: string) {
    const row = await this.requireOwned(userId, id);
    const updated = row.readAt
      ? row
      : await this.prisma.notification.update({
          where: { id },
          data: { readAt: new Date() },
        });
    return { success: true as const, notification: this.toView(updated) };
  }

  public async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, deletedAt: null, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true as const };
  }

  /** Internal use by domain event listeners; never throws on bad input beyond validation. */
  public async createInApp(
    input: CreateInAppNotificationInput,
  ): Promise<Notification | null> {
    const inAppAllowed = await this.preferences.isChannelEnabled(
      input.userId,
      'inApp',
      input.type,
    );
    let row: Notification | null = null;
    if (inAppAllowed) {
      row = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          rideId: input.rideId,
          orderId: input.orderId,
          bookingId: input.bookingId,
          data: input.data as object | undefined,
        },
      });
    }

    try {
      const data: Record<string, string> = { type: input.type };
      if (input.rideId) data.rideId = input.rideId;
      if (input.orderId) data.orderId = input.orderId;
      if (input.bookingId) data.bookingId = input.bookingId;
      await this.pushDelivery.sendToUser({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data,
      });
    } catch (error) {
      this.logger.warn(
        `Push fan-out failed for ${input.userId}: ${(error as Error).message}`,
      );
    }

    return row;
  }

  private async requireOwned(userId: string, id: string): Promise<Notification> {
    const row = await this.prisma.notification.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Notification not found');
    if (row.userId !== userId) {
      throw new ForbiddenException('Cannot access another user notification');
    }
    return row;
  }

  private toView(row: Notification): NotificationView {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt,
      rideId: row.rideId,
      orderId: row.orderId,
      bookingId: row.bookingId,
      data: row.data,
      read: row.readAt !== null,
      readAt: row.readAt,
    };
  }
}
