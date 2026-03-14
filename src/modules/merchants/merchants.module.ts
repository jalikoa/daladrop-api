import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MerchantProfile } from './entities/merchant-profile.entity';
import { MerchantRepository } from './repositories/merchant.repository';
import { CreateMerchantUseCase } from './use-cases/create-merchant.usecase';
import { FindMerchantUseCase } from './use-cases/find-merchant.usecase';
import { GeneratePaymentLinkUseCase } from './use-cases/generate-payment-link.usecase';
import { MerchantsService } from './merchants.service';
import { MerchantsController } from './merchants.controller';
import { MerchantListener } from './listeners/merchant.listener';
import { EncryptionService } from '../../common/security/encryption.service';
import { QrService } from '../qr/qr.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MerchantProfile], 'merchant'),
    BullModule.registerQueue(
      { name: 'notification-events' },
      { name: 'audit-queue' },
    ),
    EventEmitterModule.forRoot(),
  ],
  providers: [
    MerchantRepository,
    { provide: 'IMerchantRepository', useExisting: MerchantRepository },
    CreateMerchantUseCase,
    FindMerchantUseCase,
    GeneratePaymentLinkUseCase,
    MerchantsService,
    MerchantListener,
    EncryptionService,
    QrService,
  ],
  controllers: [MerchantsController],
  exports: [MerchantsService, 'IMerchantRepository', GeneratePaymentLinkUseCase],
})
export class MerchantsModule {}
