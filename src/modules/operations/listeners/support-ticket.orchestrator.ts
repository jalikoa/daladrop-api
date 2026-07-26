import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Optional } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RealtimeService } from '../../../platform/realtime/realtime.service';
import { EmailService } from '../../../platform/messaging/email/email.service';
import { NotificationsService } from '../../notifications/use-cases/notifications.service';
import { NotificationType } from '../../notifications/domain/notification.types';

interface TicketCreatedPayload {
  readonly ticketId: string;
  readonly requesterId: string;
  readonly assignedTo?: string | null;
  readonly subject: string;
  readonly status: string;
}

interface TicketAssignedPayload {
  readonly ticketId: string;
  readonly assignedTo: string;
  readonly previousAssignee?: string | null;
  readonly actorId?: string;
}

interface TicketStatusChangedPayload {
  readonly ticketId: string;
  readonly fromStatus: string;
  readonly toStatus: string;
  readonly requesterId?: string;
  readonly assignedTo?: string | null;
  readonly actorId?: string;
}

interface TicketRepliedPayload {
  readonly ticketId: string;
  readonly messageId: string;
  readonly authorId: string;
  readonly isInternal?: boolean;
  readonly requesterId?: string;
  readonly assignedTo?: string | null;
}

/**
 * Fans out support ticket domain events to realtime rooms, in-app
 * notifications, and optional email. Never throws into domain services.
 */
@Injectable()
export class SupportTicketOrchestrator {
  private readonly logger = new Logger(SupportTicketOrchestrator.name);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly email?: EmailService,
  ) {}

  @OnEvent('support.TicketCreated')
  public async onCreated(event: TicketCreatedPayload): Promise<void> {
    await this.publishRoom(event.ticketId, 'ticketCreated', event);
    await this.notifyUser(
      event.requesterId,
      event.ticketId,
      'Support ticket created',
      `Your ticket "${event.subject}" was created.`,
    );
  }

  @OnEvent('support.TicketAssigned')
  public async onAssigned(event: TicketAssignedPayload): Promise<void> {
    await this.publishRoom(event.ticketId, 'ticketAssigned', event);
    await this.notifyUser(
      event.assignedTo,
      event.ticketId,
      'Ticket assigned to you',
      'A support ticket was assigned to you.',
    );
    if (event.previousAssignee && event.previousAssignee !== event.assignedTo) {
      await this.notifyUser(
        event.previousAssignee,
        event.ticketId,
        'Ticket reassigned',
        'A support ticket was reassigned away from you.',
      );
    }
  }

  @OnEvent('support.TicketStatusChanged')
  public async onStatusChanged(
    event: TicketStatusChangedPayload,
  ): Promise<void> {
    await this.publishRoom(event.ticketId, 'ticketStatusChanged', event);
    const targets = new Set<string>();
    if (event.requesterId) targets.add(event.requesterId);
    if (event.assignedTo) targets.add(event.assignedTo);
    for (const userId of targets) {
      await this.notifyUser(
        userId,
        event.ticketId,
        'Ticket status updated',
        `Status changed from ${event.fromStatus} to ${event.toStatus}.`,
      );
    }
  }

  @OnEvent('support.TicketReplied')
  public async onReplied(event: TicketRepliedPayload): Promise<void> {
    await this.publishRoom(event.ticketId, 'ticketReplied', event);
    if (event.isInternal) return;
    const targets = new Set<string>();
    if (event.requesterId && event.requesterId !== event.authorId) {
      targets.add(event.requesterId);
    }
    if (event.assignedTo && event.assignedTo !== event.authorId) {
      targets.add(event.assignedTo);
    }
    for (const userId of targets) {
      await this.notifyUser(
        userId,
        event.ticketId,
        'New reply on your ticket',
        'There is a new message on a support ticket.',
      );
    }
  }

  private async publishRoom(
    ticketId: string,
    type: string,
    payload: unknown,
  ): Promise<void> {
    try {
      await this.realtime.publishToRoom(`ticket:${ticketId}`, {
        type,
        payload,
      });
    } catch (error) {
      this.logger.warn(
        `Realtime publish failed for ticket ${ticketId}: ${(error as Error).message}`,
      );
    }
  }

  private async notifyUser(
    userId: string,
    ticketId: string,
    title: string,
    body: string,
  ): Promise<void> {
    try {
      await this.notifications.createInApp({
        userId,
        type: NotificationType.SUPPORT_TICKET,
        title,
        body,
        data: { ticketId },
      });
    } catch (error) {
      this.logger.warn(
        `In-app notify failed for ${userId}: ${(error as Error).message}`,
      );
    }

    if (process.env.SUPPORT_EMAIL_NOTIFICATIONS !== 'true' || !this.email) {
      return;
    }
    try {
      const user = await this.prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { email: true },
      });
      if (!user?.email) return;
      await this.email.send('smtp', {
        to: [user.email],
        from: process.env.EMAIL_FROM ?? 'noreply@daladrop.local',
        subject: title,
        text: body,
      });
    } catch (error) {
      this.logger.debug(`Email skip: ${(error as Error).message}`);
    }
  }
}
