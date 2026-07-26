import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorType,
  AuditAction,
  FiscalPeriodStatus,
  type AccountingPeriod,
  type FiscalPeriod,
  type Prisma,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';

function periodView(row: AccountingPeriod & { fiscalPeriod?: FiscalPeriod }) {
  return {
    id: row.id,
    fiscalPeriodId: row.fiscalPeriodId,
    name: row.name,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
    fiscalPeriod: row.fiscalPeriod
      ? {
          id: row.fiscalPeriod.id,
          name: row.fiscalPeriod.name,
          startsAt: row.fiscalPeriod.startsAt.toISOString(),
          endsAt: row.fiscalPeriod.endsAt.toISOString(),
          status: row.fiscalPeriod.status,
        }
      : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Calendar month bounds in UTC: [start, nextMonthStart). */
export function calendarMonthBounds(at: Date): {
  startsAt: Date;
  endsAt: Date;
  name: string;
} {
  const year = at.getUTCFullYear();
  const month = at.getUTCMonth();
  const startsAt = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const endsAt = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  const name = `${year}-${String(month + 1).padStart(2, '0')}`;
  return { startsAt, endsAt, name };
}

export function calendarYearBounds(at: Date): {
  startsAt: Date;
  endsAt: Date;
  name: string;
} {
  const year = at.getUTCFullYear();
  return {
    startsAt: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    endsAt: new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0)),
    name: `FY${year}`,
  };
}

type TxClient = Prisma.TransactionClient;

@Injectable()
export class AccountingPeriodsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: EventEmitter2,
  ) {}

  public async list() {
    const rows = await this.prisma.accountingPeriod.findMany({
      include: { fiscalPeriod: true },
      orderBy: { startsAt: 'desc' },
    });
    return { success: true as const, items: rows.map(periodView) };
  }

  /**
   * Ensure an OPEN accounting period covers `at`. Creates calendar-year
   * FiscalPeriod + calendar-month AccountingPeriod when missing.
   */
  public async ensureOpenPeriod(
    at: Date = new Date(),
    tx?: TxClient,
  ): Promise<AccountingPeriod> {
    const client = tx ?? this.prisma;
    const existing = await client.accountingPeriod.findFirst({
      where: {
        status: FiscalPeriodStatus.OPEN,
        startsAt: { lte: at },
        endsAt: { gt: at },
      },
      orderBy: { startsAt: 'desc' },
    });
    if (existing) return existing;

    const year = calendarYearBounds(at);
    let fiscal = await client.fiscalPeriod.findFirst({
      where: {
        startsAt: year.startsAt,
        endsAt: year.endsAt,
      },
    });
    if (!fiscal) {
      fiscal = await client.fiscalPeriod.create({
        data: {
          name: year.name,
          startsAt: year.startsAt,
          endsAt: year.endsAt,
          status: FiscalPeriodStatus.OPEN,
        },
      });
    } else if (fiscal.status !== FiscalPeriodStatus.OPEN) {
      throw new BadRequestException(
        `Fiscal period ${fiscal.name} is ${fiscal.status}; cannot open monthly period`,
      );
    }

    const month = calendarMonthBounds(at);
    const period = await client.accountingPeriod.create({
      data: {
        fiscalPeriodId: fiscal.id,
        name: month.name,
        startsAt: month.startsAt,
        endsAt: month.endsAt,
        status: FiscalPeriodStatus.OPEN,
      },
    });

    if (!tx) {
      await this.audit.record({
        tableName: 'accounting_periods',
        recordId: period.id,
        action: AuditAction.INSERT,
        actorType: ActorType.SYSTEM,
        afterData: periodView(period),
        reason: 'ensureOpenPeriod',
      });
    }

    return period;
  }

  public async ensureAt(atIso?: string) {
    const at = atIso ? new Date(atIso) : new Date();
    if (Number.isNaN(at.getTime())) {
      throw new BadRequestException('Invalid at timestamp');
    }
    const period = await this.ensureOpenPeriod(at);
    return { success: true as const, period: periodView(period) };
  }

  public async closePeriod(
    actorId: string,
    periodId: string,
    reason?: string,
  ) {
    const period = await this.prisma.accountingPeriod.findUnique({
      where: { id: periodId },
      include: { fiscalPeriod: true },
    });
    if (!period) {
      throw new NotFoundException(`Accounting period ${periodId} not found`);
    }
    if (period.status === FiscalPeriodStatus.CLOSED) {
      return { success: true as const, period: periodView(period) };
    }
    if (period.status === FiscalPeriodStatus.LOCKED) {
      throw new BadRequestException('Locked periods cannot be closed via this API');
    }

    const updated = await this.prisma.accountingPeriod.update({
      where: { id: periodId },
      data: { status: FiscalPeriodStatus.CLOSED },
      include: { fiscalPeriod: true },
    });

    await this.audit.record({
      tableName: 'accounting_periods',
      recordId: period.id,
      action: AuditAction.STATUS_CHANGE,
      actorId,
      actorType: ActorType.USER,
      beforeData: { status: period.status },
      afterData: { status: updated.status },
      changedFields: ['status'],
      reason: reason ?? 'Period closed',
    });

    this.events.emit('accounting.PeriodClosed', {
      periodId: updated.id,
      closedBy: actorId,
      at: new Date().toISOString(),
    });

    return { success: true as const, period: periodView(updated) };
  }
}
