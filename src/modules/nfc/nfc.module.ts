import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NfcTag } from './entities/nfc-tag.entity';
import { NfcRepository } from './repositories/nfc.repository';
import { CreateNfcTagUseCase } from './use-cases/create-nfc-tag.usecase';
import { DecodeTokenUseCase } from './use-cases/decode-token.usecase';
import { NfcService } from './nfc.service';
import { NfcController } from './nfc.controller';
import { NfcListener } from './listeners/nfc.listener';
import { EncryptionService } from '../../common/security/encryption.service';
import { MerchantsModule } from '../merchants/merchants.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NfcTag]),
    BullModule.registerQueue(
      { name: 'payments-queue' },
      { name: 'audit-queue' },
    ),
    EventEmitterModule.forRoot(),
    MerchantsModule,
  ],
  providers: [
    NfcRepository,
    { provide: 'INfcRepository', useExisting: NfcRepository },
    CreateNfcTagUseCase,
    DecodeTokenUseCase,
    NfcService,
    NfcListener,
    EncryptionService,
  ],
  controllers: [NfcController],
  exports: [NfcService, DecodeTokenUseCase],
})
export class NfcModule {}
