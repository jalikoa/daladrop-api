import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorType,
  AuditAction,
  Prisma,
  SupportTicketStatus,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PrismaOutboxWriter } from '../../../infrastructure/database/outbox/prisma-outbox.writer';
import { PaginationService } from '../../../platform/api/pagination/pagination.service';
import { AuditLogService } from './audit-log.service';
import { assertSupportTransition } from '../domain/support-ticket-lifecycle';

export type SupportReplyRole = 'customer' | 'merchant' | 'admin';

@Injectable()
export class SupportTicketsService {
  private readonly pagination = new PaginationService(20, 100);
  private readonly outbox: PrismaOutboxWriter;

  public constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly audit: AuditLogService,
  ) {
    this.outbox = new PrismaOutboxWriter(this.prisma);
  }

  public async create(
    requesterId: string,
    input: {
      readonly subject: string;
      readonly body: string;
      readonly priority?: number;
      readonly categoryId?: string;
      readonly merchantId?: string;
    },
  ) {
    let slaDueAt: Date | null = null;
    let priority = input.priority ?? 3;
    if (input.categoryId) {
      const category = await this.prisma.supportTicketCategory.findFirst({
        where: { id: input.categoryId, isActive: true },
      });
      if (!category) throw new NotFoundException('Support category not found');
      slaDueAt = new Date(Date.now() + category.slaHours * 3_600_000);
    }
    if (input.merchantId) {
      const merchant = await this.prisma.merchant.findFirst({
        where: { id: input.merchantId, deletedAt: null },
        select: { id: true },
      });
      if (!merchant) throw new NotFoundException('Merchant not found');
    }

    const row = await this.prisma.supportTicket.create({
      data: {
        requesterId,
        subject: input.subject.trim(),
        body: input.body.trim(),
        priority,
        categoryId: input.categoryId ?? null,
        merchantId: input.merchantId ?? null,
        slaDueAt,
      },
    });

    await this.outbox.append({
      eventId: `support.TicketCreated-${row.id}`,
      aggregateId: row.id,
      eventName: 'support.TicketCreated',
      payload: {
        ticketId: row.id,
        requesterId,
        merchantId: row.merchantId,
        status: row.status,
      },
    });

    await this.audit.record({
      tableName: 'support_tickets',
      recordId: row.id,
      action: AuditAction.INSERT,
      actorId: requesterId,
      actorType: ActorType.USER,
      afterData: this.toView(row),
    });

    this.events.emit('support.TicketCreated', {
      ticketId: row.id,
      requesterId,
      assignedTo: row.assignedTo,
      subject: row.subject,
      status: row.status,
    });

    return { success: true as const, ticket: this.toView(row) };
  }

  public async listMine(
    requesterId: string,
    query: { readonly page?: number; readonly limit?: number } = {},
  ) {
    const { page, limit } = this.pagination.normalizeOffset({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
    const where = { requesterId, mergedIntoId: null };
    const [total, rows] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      success: true as const,
      items: rows.map((row) => this.toView(row)),
      page,
      hasMore: page * limit < total,
      total,
    };
  }

  public async getMine(requesterId: string, id: string) {
    const row = await this.requireOwned(requesterId, id);
    return { success: true as const, ticket: this.toView(row) };
  }

  public async listForMerchant(
    actorId: string,
    merchantId: string,
    query: { readonly page?: number; readonly limit?: number } = {},
  ) {
    await this.requireMerchantOwner(actorId, merchantId);
    const { page, limit } = this.pagination.normalizeOffset({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
    const where = { merchantId, mergedIntoId: null };
    const [total, rows] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      success: true as const,
      items: rows.map((row) => this.toView(row)),
      page,
      hasMore: page * limit < total,
      total,
    };
  }

  public async createForMerchant(
    actorId: string,
    merchantId: string,
    input: {
      readonly subject: string;
      readonly body: string;
      readonly priority?: number;
      readonly categoryId?: string;
    },
  ) {
    await this.requireMerchantOwner(actorId, merchantId);
    return this.create(actorId, { ...input, merchantId });
  }

  public async getForMerchant(
    actorId: string,
    merchantId: string,
    id: string,
  ) {
    await this.requireMerchantOwner(actorId, merchantId);
    const row = await this.requireMerchantTicket(merchantId, id);
    return { success: true as const, ticket: this.toView(row) };
  }

  public async reply(
    actorId: string,
    ticketId: string,
    input: {
      readonly body: string;
      readonly role: SupportReplyRole;
      readonly merchantId?: string;
      readonly isInternal?: boolean;
    },
  ) {
    const ticket = await this.loadTicket(ticketId);
    this.assertReplyAccess(actorId, ticket, input);
    if (
      ticket.status === SupportTicketStatus.CLOSED ||
      ticket.status === SupportTicketStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot reply to a closed or cancelled ticket');
    }
    if (input.isInternal && input.role !== 'admin') {
      throw new ForbiddenException('Only admins can post internal notes');
    }

    const message = await this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        authorId: actorId,
        body: input.body.trim(),
        isInternal: input.isInternal ?? false,
      },
    });

    if (!input.isInternal) {
      let nextStatus: SupportTicketStatus | null = null;
      if (input.role === 'customer' || input.role === 'merchant') {
        // Requester/merchant replied → back to agent queue.
        if (
          ticket.status === SupportTicketStatus.WAITING_CUSTOMER ||
          ticket.status === SupportTicketStatus.WAITING_MERCHANT ||
          ticket.status === SupportTicketStatus.OPEN ||
          ticket.status === SupportTicketStatus.PENDING
        ) {
          nextStatus = SupportTicketStatus.IN_PROGRESS;
        }
      } else if (ticket.status === SupportTicketStatus.IN_PROGRESS) {
        nextStatus = SupportTicketStatus.WAITING_CUSTOMER;
      }
      if (nextStatus && nextStatus !== ticket.status) {
        await this.transitionStatus(ticket, nextStatus, actorId, false);
      }
    }

    await this.audit.record({
      tableName: 'support_ticket_messages',
      recordId: message.id,
      action: AuditAction.INSERT,
      actorId,
      afterData: {
        ticketId,
        authorId: actorId,
        isInternal: message.isInternal,
      },
    });

    this.events.emit('support.TicketReplied', {
      ticketId,
      messageId: message.id,
      authorId: actorId,
      isInternal: message.isInternal,
      requesterId: ticket.requesterId,
      assignedTo: ticket.assignedTo,
    });

    return {
      success: true as const,
      message: {
        id: message.id,
        ticketId: message.ticketId,
        authorId: message.authorId,
        body: message.body,
        isInternal: message.isInternal,
        createdAt: message.createdAt,
      },
    };
  }

  public async addAttachment(
    actorId: string,
    ticketId: string,
    input: {
      readonly fileUrl: string;
      readonly fileName: string;
      readonly mimeType?: string;
      readonly messageId?: string;
      readonly merchantId?: string;
      readonly asAdmin?: boolean;
    },
  ) {
    const ticket = await this.loadTicket(ticketId);
    if (input.asAdmin) {
      // admin path
    } else if (input.merchantId) {
      await this.requireMerchantOwner(actorId, input.merchantId);
      if (ticket.merchantId !== input.merchantId) {
        throw new ForbiddenException('Ticket does not belong to merchant');
      }
    } else if (ticket.requesterId !== actorId) {
      throw new ForbiddenException('Cannot attach to another user ticket');
    }

    const attachment = await this.prisma.supportTicketAttachment.create({
      data: {
        ticketId,
        messageId: input.messageId ?? null,
        uploadedBy: actorId,
        fileUrl: input.fileUrl.trim(),
        fileName: input.fileName.trim(),
        mimeType: input.mimeType ?? null,
      },
    });

    await this.audit.record({
      tableName: 'support_ticket_attachments',
      recordId: attachment.id,
      action: AuditAction.INSERT,
      actorId,
      afterData: {
        ticketId,
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
      },
    });

    return {
      success: true as const,
      attachment: {
        id: attachment.id,
        ticketId: attachment.ticketId,
        messageId: attachment.messageId,
        fileUrl: attachment.fileUrl,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        createdAt: attachment.createdAt,
      },
    };
  }

  public async close(actorId: string, ticketId: string) {
    const ticket = await this.requireOwned(actorId, ticketId);
    return this.transitionStatus(ticket, SupportTicketStatus.CLOSED, actorId);
  }

  public async reopen(actorId: string, ticketId: string) {
    const ticket = await this.requireOwned(actorId, ticketId);
    return this.transitionStatus(ticket, SupportTicketStatus.OPEN, actorId);
  }

  public async cancel(actorId: string, ticketId: string) {
    const ticket = await this.requireOwned(actorId, ticketId);
    return this.transitionStatus(ticket, SupportTicketStatus.CANCELLED, actorId);
  }

  public async adminList(
    query: {
      readonly status?: SupportTicketStatus;
      readonly page?: number;
      readonly limit?: number;
    } = {},
  ) {
    const { page, limit } = this.pagination.normalizeOffset({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
    const where: Prisma.SupportTicketWhereInput = {
      mergedIntoId: null,
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      success: true as const,
      items: rows.map((row) => this.toView(row)),
      page,
      hasMore: page * limit < total,
      total,
    };
  }

  public async adminGet(id: string) {
    const row = await this.loadTicket(id);
    const [messages, attachments] = await Promise.all([
      this.prisma.supportTicketMessage.findMany({
        where: { ticketId: id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.supportTicketAttachment.findMany({
        where: { ticketId: id },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return {
      success: true as const,
      ticket: this.toView(row),
      messages,
      attachments,
    };
  }

  /** @deprecated Prefer typed admin actions; kept for PATCH compatibility. */
  public async adminUpdate(
    id: string,
    input: {
      readonly status?: SupportTicketStatus;
      readonly assignedTo?: string | null;
      readonly priority?: number;
    },
    actorId?: string,
  ) {
    const existing = await this.loadTicket(id);
    if (input.assignedTo !== undefined && input.assignedTo !== existing.assignedTo) {
      if (input.assignedTo) {
        return this.assign(id, input.assignedTo, actorId);
      }
      const cleared = await this.prisma.supportTicket.update({
        where: { id },
        data: { assignedTo: null },
      });
      return { success: true as const, ticket: this.toView(cleared) };
    }
    if (input.priority !== undefined) {
      return this.setPriority(id, input.priority, actorId);
    }
    if (input.status !== undefined) {
      return this.transitionStatus(existing, input.status, actorId);
    }
    return { success: true as const, ticket: this.toView(existing) };
  }

  public async assign(ticketId: string, assigneeId: string, actorId?: string) {
    const ticket = await this.loadTicket(ticketId);
    await this.requireUser(assigneeId);
    const previousAssignee = ticket.assignedTo;
    const nextStatus =
      ticket.status === SupportTicketStatus.OPEN ||
      ticket.status === SupportTicketStatus.PENDING
        ? SupportTicketStatus.ASSIGNED
        : ticket.status;
    if (nextStatus !== ticket.status) {
      assertSupportTransition(ticket.status, nextStatus);
    }

    const row = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        assignedTo: assigneeId,
        status: nextStatus,
      },
    });

    await this.outbox.append({
      eventId: `support.TicketAssigned-${ticketId}-${assigneeId}-${Date.now()}`,
      aggregateId: ticketId,
      eventName: 'support.TicketAssigned',
      payload: {
        ticketId,
        assignedTo: assigneeId,
        previousAssignee,
        actorId,
      },
    });

    await this.audit.record({
      tableName: 'support_tickets',
      recordId: ticketId,
      action: AuditAction.UPDATE,
      actorId,
      beforeData: { assignedTo: previousAssignee, status: ticket.status },
      afterData: { assignedTo: assigneeId, status: row.status },
      changedFields: ['assignedTo', 'status'],
      reason: 'assign',
    });

    this.events.emit('support.TicketAssigned', {
      ticketId,
      assignedTo: assigneeId,
      previousAssignee,
      actorId,
    });
    if (row.status !== ticket.status) {
      this.events.emit('support.TicketStatusChanged', {
        ticketId,
        fromStatus: ticket.status,
        toStatus: row.status,
        requesterId: ticket.requesterId,
        assignedTo: assigneeId,
        actorId,
      });
    }

    return { success: true as const, ticket: this.toView(row) };
  }

  public async reassign(
    ticketId: string,
    assigneeId: string,
    actorId?: string,
  ) {
    return this.assign(ticketId, assigneeId, actorId);
  }

  public async escalate(ticketId: string, actorId?: string) {
    const ticket = await this.loadTicket(ticketId);
    const row = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: (() => {
          assertSupportTransition(ticket.status, SupportTicketStatus.ESCALATED);
          return SupportTicketStatus.ESCALATED;
        })(),
        escalatedAt: ticket.escalatedAt ?? new Date(),
        priority: Math.max(1, ticket.priority - 1),
      },
    });

    await this.audit.record({
      tableName: 'support_tickets',
      recordId: ticketId,
      action: AuditAction.UPDATE,
      actorId,
      beforeData: { status: ticket.status, priority: ticket.priority },
      afterData: { status: row.status, priority: row.priority },
      changedFields: ['status', 'priority', 'escalatedAt'],
      reason: 'escalate',
    });

    this.events.emit('support.TicketStatusChanged', {
      ticketId,
      fromStatus: ticket.status,
      toStatus: row.status,
      requesterId: ticket.requesterId,
      assignedTo: row.assignedTo,
      actorId,
    });

    return { success: true as const, ticket: this.toView(row) };
  }

  public async merge(
    sourceTicketId: string,
    targetTicketId: string,
    actorId?: string,
  ) {
    if (sourceTicketId === targetTicketId) {
      throw new BadRequestException('Cannot merge a ticket into itself');
    }
    const [source, target] = await Promise.all([
      this.loadTicket(sourceTicketId),
      this.loadTicket(targetTicketId),
    ]);
    if (source.mergedIntoId) {
      throw new BadRequestException('Source ticket already merged');
    }

    const [sourceUpdated] = await this.prisma.$transaction([
      this.prisma.supportTicket.update({
        where: { id: sourceTicketId },
        data: {
          mergedIntoId: targetTicketId,
          status: SupportTicketStatus.CLOSED,
          closedAt: source.closedAt ?? new Date(),
        },
      }),
      this.prisma.supportTicketMessage.create({
        data: {
          ticketId: targetTicketId,
          authorId: actorId ?? target.requesterId,
          body: `Merged ticket ${sourceTicketId} (subject: ${source.subject})`,
          isInternal: true,
        },
      }),
    ]);

    await this.audit.record({
      tableName: 'support_tickets',
      recordId: sourceTicketId,
      action: AuditAction.UPDATE,
      actorId,
      beforeData: { status: source.status, mergedIntoId: null },
      afterData: {
        status: sourceUpdated.status,
        mergedIntoId: targetTicketId,
      },
      changedFields: ['mergedIntoId', 'status'],
      reason: 'merge',
    });

    this.events.emit('support.TicketStatusChanged', {
      ticketId: sourceTicketId,
      fromStatus: source.status,
      toStatus: SupportTicketStatus.CLOSED,
      requesterId: source.requesterId,
      assignedTo: source.assignedTo,
      actorId,
    });

    return {
      success: true as const,
      source: this.toView(sourceUpdated),
      target: this.toView(target),
    };
  }

  public async resolve(ticketId: string, actorId?: string) {
    const ticket = await this.loadTicket(ticketId);
    return this.transitionStatus(
      ticket,
      SupportTicketStatus.RESOLVED,
      actorId,
    );
  }

  public async setPriority(
    ticketId: string,
    priority: number,
    actorId?: string,
  ) {
    if (priority < 1 || priority > 5) {
      throw new BadRequestException('priority must be between 1 and 5');
    }
    const ticket = await this.loadTicket(ticketId);
    const row = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { priority },
    });
    await this.audit.record({
      tableName: 'support_tickets',
      recordId: ticketId,
      action: AuditAction.UPDATE,
      actorId,
      beforeData: { priority: ticket.priority },
      afterData: { priority },
      changedFields: ['priority'],
    });
    return { success: true as const, ticket: this.toView(row) };
  }

  public async internalNote(
    actorId: string,
    ticketId: string,
    body: string,
  ) {
    return this.reply(actorId, ticketId, {
      body,
      role: 'admin',
      isInternal: true,
    });
  }

  private async transitionStatus(
    ticket: {
      id: string;
      status: SupportTicketStatus;
      requesterId: string;
      assignedTo: string | null;
      closedAt: Date | null;
    },
    to: SupportTicketStatus,
    actorId?: string,
    emit = true,
  ) {
    assertSupportTransition(ticket.status, to);
    const terminal =
      to === SupportTicketStatus.CLOSED ||
      to === SupportTicketStatus.RESOLVED ||
      to === SupportTicketStatus.CANCELLED;
    const reopening = to === SupportTicketStatus.OPEN;
    const row = await this.prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: to,
        ...(terminal && !ticket.closedAt ? { closedAt: new Date() } : {}),
        ...(reopening ? { closedAt: null } : {}),
      },
    });

    await this.audit.record({
      tableName: 'support_tickets',
      recordId: ticket.id,
      action: AuditAction.UPDATE,
      actorId,
      beforeData: { status: ticket.status },
      afterData: { status: to },
      changedFields: ['status'],
      reason: 'status_transition',
    });

    if (emit && ticket.status !== to) {
      this.events.emit('support.TicketStatusChanged', {
        ticketId: ticket.id,
        fromStatus: ticket.status,
        toStatus: to,
        requesterId: ticket.requesterId,
        assignedTo: ticket.assignedTo,
        actorId,
      });
    }

    return { success: true as const, ticket: this.toView(row) };
  }

  private assertReplyAccess(
    actorId: string,
    ticket: {
      requesterId: string;
      merchantId: string | null;
    },
    input: {
      readonly role: SupportReplyRole;
      readonly merchantId?: string;
    },
  ): void {
    if (input.role === 'admin') return;
    if (input.role === 'customer') {
      if (ticket.requesterId !== actorId) {
        throw new ForbiddenException('Cannot reply to another user ticket');
      }
      return;
    }
    if (input.role === 'merchant') {
      if (!input.merchantId || ticket.merchantId !== input.merchantId) {
        throw new ForbiddenException('Ticket does not belong to merchant');
      }
      return;
    }
    throw new ForbiddenException('Invalid reply role');
  }

  private async requireOwned(requesterId: string, id: string) {
    const row = await this.loadTicket(id);
    if (row.requesterId !== requesterId) {
      throw new ForbiddenException('Cannot access another user ticket');
    }
    return row;
  }

  private async requireMerchantTicket(merchantId: string, id: string) {
    const row = await this.loadTicket(id);
    if (row.merchantId !== merchantId) {
      throw new ForbiddenException('Ticket does not belong to merchant');
    }
    return row;
  }

  private async requireMerchantOwner(
    actorId: string,
    merchantId: string,
  ): Promise<void> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id: merchantId, deletedAt: null },
      select: { ownerUserId: true },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    if (merchant.ownerUserId !== actorId) {
      throw new ForbiddenException('Not the merchant owner');
    }
  }

  private async requireUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Assignee user not found');
  }

  private async loadTicket(id: string) {
    const row = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Support ticket not found');
    return row;
  }

  private toView(row: {
    id: string;
    requesterId: string;
    merchantId?: string | null;
    categoryId?: string | null;
    subject: string;
    body: string;
    status: SupportTicketStatus;
    priority: number;
    assignedTo: string | null;
    mergedIntoId?: string | null;
    slaDueAt?: Date | null;
    escalatedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    closedAt: Date | null;
  }) {
    return {
      id: row.id,
      requesterId: row.requesterId,
      merchantId: row.merchantId ?? null,
      categoryId: row.categoryId ?? null,
      subject: row.subject,
      body: row.body,
      status: row.status,
      priority: row.priority,
      assignedTo: row.assignedTo,
      mergedIntoId: row.mergedIntoId ?? null,
      slaDueAt: row.slaDueAt ?? null,
      escalatedAt: row.escalatedAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      closedAt: row.closedAt,
    };
  }
}
