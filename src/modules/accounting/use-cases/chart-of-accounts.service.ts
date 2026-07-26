import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountType,
  AuditAction,
  ActorType,
  NormalBalance,
  type Account,
  type ChartOfAccounts,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';
import { DEFAULT_CHART_CODE } from '../constants/coa-codes';
import type { CreateAccountDto } from '../dto/accounting.dto';

function accountView(row: Account) {
  return {
    id: row.id,
    chartOfAccountsId: row.chartOfAccountsId,
    code: row.code,
    name: row.name,
    accountType: row.accountType,
    normalBalance: row.normalBalance,
    parentId: row.parentId,
    currency: row.currency,
    isSystem: row.isSystem,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function chartView(row: ChartOfAccounts) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    currency: row.currency,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class ChartOfAccountsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  public async listCharts() {
    const rows = await this.prisma.chartOfAccounts.findMany({
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    });
    return { success: true as const, items: rows.map(chartView) };
  }

  public async listAccounts(chartCode?: string) {
    const code = chartCode?.trim() || DEFAULT_CHART_CODE;
    const chart = await this.prisma.chartOfAccounts.findUnique({
      where: { code },
    });
    if (!chart) {
      throw new NotFoundException(`Chart of accounts ${code} not found`);
    }
    const rows = await this.prisma.account.findMany({
      where: { chartOfAccountsId: chart.id },
      orderBy: { code: 'asc' },
    });
    return {
      success: true as const,
      chart: chartView(chart),
      items: rows.map(accountView),
    };
  }

  public async getByCode(code: string, chartCode = DEFAULT_CHART_CODE) {
    const chart = await this.prisma.chartOfAccounts.findUnique({
      where: { code: chartCode },
    });
    if (!chart) {
      throw new NotFoundException(`Chart of accounts ${chartCode} not found`);
    }
    const account = await this.prisma.account.findUnique({
      where: {
        chartOfAccountsId_code: {
          chartOfAccountsId: chart.id,
          code,
        },
      },
    });
    if (!account) {
      throw new NotFoundException(`Account ${code} not found on chart ${chartCode}`);
    }
    return { success: true as const, account: accountView(account) };
  }

  public async createAccount(actorId: string, input: CreateAccountDto) {
    const chart = await this.prisma.chartOfAccounts.findUnique({
      where: { code: input.chartCode.trim() },
    });
    if (!chart) {
      throw new NotFoundException(
        `Chart of accounts ${input.chartCode} not found`,
      );
    }

    const existing = await this.prisma.account.findUnique({
      where: {
        chartOfAccountsId_code: {
          chartOfAccountsId: chart.id,
          code: input.code.trim(),
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Account ${input.code} already exists on chart ${chart.code}`,
      );
    }

    if (input.parentId) {
      const parent = await this.prisma.account.findFirst({
        where: { id: input.parentId, chartOfAccountsId: chart.id },
      });
      if (!parent) {
        throw new BadRequestException('parentId must belong to the same chart');
      }
    }

    const normalBalance =
      input.accountType === AccountType.ASSET ||
      input.accountType === AccountType.EXPENSE
        ? NormalBalance.DEBIT
        : NormalBalance.CREDIT;

    const created = await this.prisma.account.create({
      data: {
        chartOfAccountsId: chart.id,
        code: input.code.trim(),
        name: input.name.trim(),
        accountType: input.accountType as AccountType,
        normalBalance,
        parentId: input.parentId ?? null,
        currency: (input.currency ?? chart.currency).toUpperCase(),
        isSystem: false,
        isActive: true,
      },
    });

    await this.audit.record({
      tableName: 'accounts',
      recordId: created.id,
      action: AuditAction.INSERT,
      actorId,
      actorType: ActorType.USER,
      afterData: accountView(created),
    });

    return { success: true as const, account: accountView(created) };
  }
}
