import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { IdentityModule } from '../identity/identity.module';
import { OperationsModule } from '../operations/operations.module';
import { AdminSettlementsController } from './interfaces/admin-settlements.controller';
import {
  AdminEscrowController,
  AdminWalletsController,
} from './interfaces/admin-wallets.controller';
import { CustomerWalletController } from './interfaces/customer-wallet.controller';
import { MerchantWalletController } from './interfaces/merchant-wallet.controller';
import { RiderWalletController } from './interfaces/rider-wallet.controller';
import { JournalWalletListener } from './listeners/journal-wallet.listener';
import { EscrowService } from './use-cases/escrow.service';
import { FinanceDashboardService } from './use-cases/finance-dashboard.service';
import { SettlementService } from './use-cases/settlement.service';
import { WalletMirroringService } from './use-cases/wallet-mirroring.service';
import { WalletService } from './use-cases/wallet.service';

@Module({
  imports: [IdentityModule, AuthorizationModule, OperationsModule, AccountingModule],
  controllers: [
    CustomerWalletController,
    MerchantWalletController,
    RiderWalletController,
    AdminWalletsController,
    AdminEscrowController,
    AdminSettlementsController,
  ],
  providers: [
    WalletService,
    EscrowService,
    WalletMirroringService,
    SettlementService,
    FinanceDashboardService,
    JournalWalletListener,
  ],
  exports: [
    WalletService,
    EscrowService,
    WalletMirroringService,
    SettlementService,
    FinanceDashboardService,
  ],
})
export class WalletsModule {}
