import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PaymentSession } from './entities/payment-session.entity';
import { PaymentCallback } from './entities/payment-callback.entity';
import { Account } from '../ledger/entities/account.entity';
import { LedgerEntry } from '../ledger/entities/ledger-entry.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { MerchantProfile } from '../merchants/entities/merchant-profile.entity';
import { PaymentRepository } from './repositories/payment.repository';
import { InitiateStkUseCase } from './use-cases/initiate-stk.usecase';
import { HandleCallbackUseCase } from './use-cases/handle-callback.usecase';
import { GetPaymentUseCase } from './use-cases/get-payment.usecase';
import { GetMerchantPaymentsUseCase } from './use-cases/get-merchant-payments.usecase';
import { GetAllPaymentsUseCase } from './use-cases/get-all-payments.usecase';
import { DarajaAdapter } from './adapters/daraja.adapter';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentListener } from './listeners/payment.listener';
import { PaymentProcessor } from './processors/payment.processor';
import { PAYMENT_CONSTANTS } from './constants/payment.constants';
import { MerchantsModule } from '../merchants/merchants.module';
import { EncryptionService } from 'src/common/security/encryption.service';
// @Module({
//   imports: [
//     TypeOrmModule.forFeature([
//       PaymentSession,
//       PaymentCallback,
//       Account,
//       LedgerEntry,
//       Notification,
//       MerchantProfile,
//     ]),
//     BullModule.registerQueue({
//       name: PAYMENT_CONSTANTS.QUEUE.NAME,
//       defaultJobOptions: {
//         attempts: 3,
//         backoff: { type: 'exponential', delay: 2000 },
//         removeOnComplete: 100,
//         removeOnFail: 500,
//       },
//     }),
//     BullModule.registerQueue({ name: 'audit-queue' }),
//     EventEmitterModule.forRoot(),
//     MerchantsModule,
//   ],
//   providers: [
//     PaymentRepository,
//     { provide: 'IPaymentRepository', useExisting: PaymentRepository },
//     InitiateStkUseCase,
//     HandleCallbackUseCase,
//     GetPaymentUseCase,
//     GetMerchantPaymentsUseCase,
//     DarajaAdapter,
//     { provide: 'IDarajaAdapter', useExisting: DarajaAdapter },
//     PaymentsService,
//     PaymentListener,
//     PaymentProcessor,
//   ],
//   controllers: [PaymentsController],
//   exports: [PaymentsService, 'IPaymentRepository', InitiateStkUseCase, HandleCallbackUseCase],
// })
// export class PaymentsModule {}
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentSession,
      PaymentCallback,
      Account,          // ledger balance update
      LedgerEntry,      // double-entry writes
      Notification,     // SMS receipt row
      MerchantProfile,  // user_id lookup
    ]),
    BullModule.registerQueue({
      name: PAYMENT_CONSTANTS.QUEUE.NAME,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
    BullModule.registerQueue({ name: 'audit-queue' }),
    EventEmitterModule.forRoot(),
    MerchantsModule,
  ],
  providers: [
    PaymentRepository,
    { provide: 'IPaymentRepository', useExisting: PaymentRepository },
    InitiateStkUseCase,
    HandleCallbackUseCase,
    GetPaymentUseCase,
    GetMerchantPaymentsUseCase,
    GetAllPaymentsUseCase,
    DarajaAdapter,
    { provide: 'IDarajaAdapter', useExisting: DarajaAdapter },
    PaymentsService,
    PaymentListener,
    PaymentProcessor,
    EncryptionService,
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService, 'IPaymentRepository', InitiateStkUseCase, HandleCallbackUseCase],
})
export class PaymentsModule {}