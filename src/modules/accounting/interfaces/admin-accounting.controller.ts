import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import {
  ClosePeriodDto,
  CreateAccountDto,
  CreateJournalDraftDto,
  EnsurePeriodDto,
  ExportReportQueryDto,
  ListAccountsQueryDto,
  ListJournalsQueryDto,
  ReportPeriodQueryDto,
  ReverseJournalDto,
} from '../dto/accounting.dto';
import { AccountingPeriodsService } from '../use-cases/accounting-periods.service';
import { ChartOfAccountsService } from '../use-cases/chart-of-accounts.service';
import {
  FinancialReportsService,
  type ReportType,
} from '../use-cases/financial-reports.service';
import { JournalService } from '../use-cases/journal.service';

@ApiTags('Admin Accounting')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/accounting', version: '1' })
export class AdminAccountingController {
  public constructor(
    private readonly charts: ChartOfAccountsService,
    private readonly periods: AccountingPeriodsService,
    private readonly journals: JournalService,
    private readonly reports: FinancialReportsService,
  ) {}

  @Get('charts')
  @RequirePermission('read', 'accounting')
  public listCharts() {
    return this.charts.listCharts();
  }

  @Get('accounts')
  @RequirePermission('read', 'accounting')
  public listAccounts(@Query() query: ListAccountsQueryDto) {
    return this.charts.listAccounts(query.chartCode);
  }

  @Post('accounts')
  @RequirePermission('manage', 'accounting')
  public createAccount(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: CreateAccountDto,
  ) {
    return this.charts.createAccount(principal.id, body);
  }

  @Get('periods')
  @RequirePermission('read', 'accounting')
  public listPeriods() {
    return this.periods.list();
  }

  @Post('periods/ensure')
  @RequirePermission('manage', 'accounting')
  public ensurePeriod(@Body() body: EnsurePeriodDto) {
    return this.periods.ensureAt(body.at);
  }

  @Post('periods/:id/close')
  @RequirePermission('manage', 'accounting')
  public closePeriod(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ClosePeriodDto,
  ) {
    return this.periods.closePeriod(principal.id, id, body.reason);
  }

  @Get('journals')
  @RequirePermission('read', 'accounting')
  public listJournals(@Query() query: ListJournalsQueryDto) {
    return this.journals.list({
      status: query.status,
      paymentId: query.paymentId,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('journals/:id')
  @RequirePermission('read', 'accounting')
  public getJournal(@Param('id', ParseUUIDPipe) id: string) {
    return this.journals.getById(id);
  }

  @Post('journals')
  @RequirePermission('manage', 'accounting')
  public createJournal(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: CreateJournalDraftDto,
  ) {
    return this.journals.createDraft(principal.id, body);
  }

  @Post('journals/:id/post')
  @RequirePermission('manage', 'accounting')
  public postJournal(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.journals.postDraft(principal.id, id);
  }

  @Post('journals/:id/reverse')
  @RequirePermission('manage', 'accounting')
  public reverseJournal(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReverseJournalDto,
  ) {
    return this.journals.reversePosted(principal.id, id, body);
  }

  @Get('reports/trial-balance')
  @RequirePermission('read', 'accounting')
  public trialBalance(@Query() query: ReportPeriodQueryDto) {
    return this.reports.trialBalance(query.periodId);
  }

  @Get('reports/general-ledger')
  @RequirePermission('read', 'accounting')
  public generalLedger(@Query() query: ReportPeriodQueryDto) {
    return this.reports.generalLedger(query.accountCode, query.periodId);
  }

  @Get('reports/balance-sheet')
  @RequirePermission('read', 'accounting')
  public balanceSheet(@Query() query: ReportPeriodQueryDto) {
    return this.reports.balanceSheet(query.periodId, query.asOf);
  }

  @Get('reports/income-statement')
  @RequirePermission('read', 'accounting')
  public incomeStatement(@Query() query: ReportPeriodQueryDto) {
    return this.reports.incomeStatement(query.periodId);
  }

  @Get('reports/account-statement')
  @RequirePermission('read', 'accounting')
  public accountStatement(@Query() query: ReportPeriodQueryDto) {
    return this.reports.statementOfAccount(query.accountCode, query.periodId);
  }

  @Get('reports/accounts-payable')
  @RequirePermission('read', 'accounting')
  public accountsPayable(@Query() query: ReportPeriodQueryDto) {
    return this.reports.accountsPayable(query.periodId);
  }

  @Get('reports/accounts-receivable')
  @RequirePermission('read', 'accounting')
  public accountsReceivable(@Query() query: ReportPeriodQueryDto) {
    return this.reports.accountsReceivable(query.periodId);
  }

  @Get('reports/commission')
  @RequirePermission('read', 'accounting')
  public commissionReport(@Query() query: ReportPeriodQueryDto) {
    return this.reports.commissionReport(query.periodId);
  }

  @Get('reports/settlement')
  @RequirePermission('read', 'accounting')
  public settlementReport(@Query() query: ReportPeriodQueryDto) {
    return this.reports.settlementReport(query.periodId);
  }

  @Get('reports/p-and-l')
  @RequirePermission('read', 'accounting')
  public pAndL(@Query() query: ReportPeriodQueryDto) {
    return this.reports.incomeStatement(query.periodId);
  }

  @Get('finance-overview')
  @RequirePermission('read', 'accounting')
  public financeOverview() {
    return this.reports.financeOverview();
  }

  @Get('reports/:reportType/export')
  @RequirePermission('read', 'accounting')
  public async exportReport(
    @Param('reportType') reportType: string,
    @Query() query: ExportReportQueryDto,
  ): Promise<StreamableFile> {
    const allowed: ReportType[] = [
      'trial-balance',
      'general-ledger',
      'balance-sheet',
      'income-statement',
      'p-and-l',
      'account-statement',
      'accounts-payable',
      'accounts-receivable',
      'commission',
      'settlement',
    ];
    if (!allowed.includes(reportType as ReportType)) {
      throw new BadRequestException(`Unknown report type ${reportType}`);
    }
    const result = await this.reports.exportReport(
      reportType as ReportType,
      query.format,
      {
        periodId: query.periodId,
        asOf: query.asOf,
        accountCode: query.accountCode,
      },
    );
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }
}
