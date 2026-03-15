import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Account } from './entities/account.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { LedgerRepository } from './repositories/ledger.repository';
import { LedgerService } from './ledger.service';
import { RecordTransactionUseCase } from './use-cases/record-transaction.usecase';
import { GetAccountBalanceUseCase } from './use-cases/get-account-balance.usecase';
import { LedgerListener } from './listeners/ledger.listener';
import { LedgerProcessor } from './processors/ledger.processor';
import { LEDGER_CONSTANTS } from './constants/ledger.constants';
import { LedgerController } from './ledger.controller';
@Module({
  imports: [
    TypeOrmModule.forFeature([Account, LedgerEntry]),
    BullModule.registerQueue({ name: LEDGER_CONSTANTS.QUEUE.NAME }),
    EventEmitterModule.forRoot(),
  ],
  controllers: [LedgerController],
  providers: [
    LedgerRepository,
    LedgerService,
    RecordTransactionUseCase,
    GetAccountBalanceUseCase,
    LedgerListener,
    LedgerProcessor,
  ],
  exports: [LedgerService, RecordTransactionUseCase, GetAccountBalanceUseCase],
})
export class LedgerModule {}
