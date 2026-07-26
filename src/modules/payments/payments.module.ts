import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { IdentityModule } from '../identity/identity.module';
import { OperationsModule } from '../operations/operations.module';
import { DarajaPaymentProvider } from './adapters/daraja-payment.provider';
import { KopoKopoPaymentProvider } from './adapters/kopokopo-payment.provider';
import { ManualPaymentProvider } from './adapters/manual-payment.provider';
import {
  PAYMENT_PROVIDERS,
  PaymentProviderRegistry,
} from './adapters/provider-registry';
import { PAYMENT_OUTBOX } from './events/payment-outbox.port';
import { PrismaPaymentOutbox } from './events/prisma-payment-outbox';
import {
  AdminPaymentsController,
  PaymentProviderCallbacksController,
  PaymentsController,
} from './interfaces/payments.controller';
import { PAYMENT_REPOSITORY } from './repositories/payment.repository';
import { PrismaPaymentRepository } from './repositories/prisma/prisma-payment.repository';
import { PaymentsService } from './use-cases/payments.service';

@Module({
  imports: [IdentityModule, AuthorizationModule, OperationsModule],
  controllers: [
    PaymentsController,
    PaymentProviderCallbacksController,
    AdminPaymentsController,
  ],
  providers: [
    ManualPaymentProvider,
    DarajaPaymentProvider,
    KopoKopoPaymentProvider,
    {
      provide: PAYMENT_PROVIDERS,
      inject: [
        ManualPaymentProvider,
        DarajaPaymentProvider,
        KopoKopoPaymentProvider,
      ],
      useFactory: (
        manual: ManualPaymentProvider,
        daraja: DarajaPaymentProvider,
        kopokopo: KopoKopoPaymentProvider,
      ) => [manual, daraja, kopokopo],
    },
    PaymentProviderRegistry,
    { provide: PAYMENT_REPOSITORY, useClass: PrismaPaymentRepository },
    { provide: PAYMENT_OUTBOX, useClass: PrismaPaymentOutbox },
    PaymentsService,
  ],
  exports: [
    PaymentsService,
    PaymentProviderRegistry,
    PAYMENT_REPOSITORY,
    PAYMENT_OUTBOX,
  ],
})
export class PaymentsModule {}
