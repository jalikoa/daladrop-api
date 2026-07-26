import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';

export interface NotificationPreferenceView {
  readonly pushEnabled: boolean;
  readonly emailEnabled: boolean;
  readonly smsEnabled: boolean;
  readonly inAppEnabled: boolean;
  readonly categories: Record<string, unknown> | null;
}

export interface UpdateNotificationPreferencesInput {
  readonly pushEnabled?: boolean;
  readonly emailEnabled?: boolean;
  readonly smsEnabled?: boolean;
  readonly inAppEnabled?: boolean;
  readonly categories?: Record<string, unknown> | null;
}

@Injectable()
export class NotificationPreferencesService {
  public constructor(private readonly prisma: PrismaService) {}

  public async get(userId: string): Promise<{
    success: true;
    preferences: NotificationPreferenceView;
  }> {
    const row = await this.ensure(userId);
    return { success: true, preferences: this.toView(row) };
  }

  public async update(
    userId: string,
    input: UpdateNotificationPreferencesInput,
  ): Promise<{ success: true; preferences: NotificationPreferenceView }> {
    await this.ensure(userId);
    const row = await this.prisma.notificationPreference.update({
      where: { userId },
      data: {
        ...(input.pushEnabled !== undefined
          ? { pushEnabled: input.pushEnabled }
          : {}),
        ...(input.emailEnabled !== undefined
          ? { emailEnabled: input.emailEnabled }
          : {}),
        ...(input.smsEnabled !== undefined
          ? { smsEnabled: input.smsEnabled }
          : {}),
        ...(input.inAppEnabled !== undefined
          ? { inAppEnabled: input.inAppEnabled }
          : {}),
        ...(input.categories !== undefined
          ? {
              categories:
                input.categories === null
                  ? Prisma.JsonNull
                  : (input.categories as Prisma.InputJsonValue),
            }
          : {}),
      },
    });
    return { success: true, preferences: this.toView(row) };
  }

  public async isChannelEnabled(
    userId: string,
    channel: 'push' | 'email' | 'sms' | 'inApp',
    type?: string,
  ): Promise<boolean> {
    const row = await this.ensure(userId);
    const base =
      channel === 'push'
        ? row.pushEnabled
        : channel === 'email'
          ? row.emailEnabled
          : channel === 'sms'
            ? row.smsEnabled
            : row.inAppEnabled;
    if (!base) return false;
    if (!type || !row.categories || typeof row.categories !== 'object') {
      return true;
    }
    const cats = row.categories as Record<string, Record<string, boolean>>;
    const override = cats[type]?.[channel];
    return override === undefined ? true : Boolean(override);
  }

  private async ensure(userId: string) {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (existing) return existing;
    return this.prisma.notificationPreference.create({
      data: { userId },
    });
  }

  private toView(row: {
    pushEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    inAppEnabled: boolean;
    categories: unknown;
  }): NotificationPreferenceView {
    return {
      pushEnabled: row.pushEnabled,
      emailEnabled: row.emailEnabled,
      smsEnabled: row.smsEnabled,
      inAppEnabled: row.inAppEnabled,
      categories:
        row.categories && typeof row.categories === 'object'
          ? (row.categories as Record<string, unknown>)
          : null,
    };
  }
}
