import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { IdentityModule } from '../identity/identity.module';
import { OperationsModule } from '../operations/operations.module';
import { AdminAccountingController } from './interfaces/admin-accounting.controller';
import { PaymentAccountingListener } from './listeners/payment-accounting.listener';
import { PaymentRefundAccountingListener } from './listeners/payment-refund-accounting.listener';
import { AccountingPeriodsService } from './use-cases/accounting-periods.service';
import { ChartOfAccountsService } from './use-cases/chart-of-accounts.service';
import { FinancialReportsService } from './use-cases/financial-reports.service';
import { JournalService } from './use-cases/journal.service';
import { PostingEngineService } from './use-cases/posting-engine.service';

@Module({
  imports: [IdentityModule, AuthorizationModule, OperationsModule],
  controllers: [AdminAccountingController],
  providers: [
    ChartOfAccountsService,
    AccountingPeriodsService,
    JournalService,
    PostingEngineService,
    FinancialReportsService,
    PaymentAccountingListener,
    PaymentRefundAccountingListener,
  ],
  exports: [
    ChartOfAccountsService,
    AccountingPeriodsService,
    JournalService,
    PostingEngineService,
    FinancialReportsService,
  ],
})
export class AccountingModule {}
