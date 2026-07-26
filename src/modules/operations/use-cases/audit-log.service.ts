import { Injectable } from '@nestjs/common';
import { AuditAction, ActorType, Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma/prisma.service';

export interface AuditLogInput {
  readonly tableName: string;
  readonly recordId: string;
  readonly action: AuditAction;
  readonly actorId?: string | null;
  readonly actorType?: ActorType;
  readonly beforeData?: unknown;
  readonly afterData?: unknown;
  readonly changedFields?: readonly string[];
  readonly reason?: string;
  readonly correlationId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export const DOMAIN_AUDIT_EVENT = 'domain.audit.recorded';

/**
 * Persists immutable {@link AuditRecord} rows and emits `domain.audit.recorded`
 * for listeners (notifications, outbox, etc.).
 */
@Injectable()
export class AuditLogService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  public async record(input: AuditLogInput): Promise<void> {
    const row = await this.prisma.auditRecord.create({
      data: {
        tableName: input.tableName,
        recordId: input.recordId,
        action: input.action,
        actorId: input.actorId ?? null,
        actorType: input.actorType ?? ActorType.USER,
        beforeData:
          input.beforeData === undefined
            ? undefined
            : (input.beforeData as Prisma.InputJsonValue),
        afterData:
          input.afterData === undefined
            ? undefined
            : (input.afterData as Prisma.InputJsonValue),
        changedFields: [...(input.changedFields ?? [])],
        reason: input.reason,
        correlationId: input.correlationId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
    this.events.emit(DOMAIN_AUDIT_EVENT, {
      id: row.id,
      tableName: row.tableName,
      recordId: row.recordId,
      action: row.action,
      actorId: row.actorId,
      createdAt: row.createdAt,
    });
  }
}
