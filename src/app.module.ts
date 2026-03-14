import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from './config/config.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
// configuration loader is provided by the ConfigModule
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { NfcModule } from './modules/nfc/nfc.module';
import { PublicController } from './interfaces/public/public.controller';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { LedgerModule } from './modules/ledger/ledger.module';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('redis.host') || config.get<string>('REDIS_HOST'),
          port: config.get<number>('redis.port') || config.get<number>('REDIS_PORT'),
        },
      }),
      inject: [ConfigService],
    }),
    // DatabaseModule (if present) should be imported here
    UsersModule,
    AuthModule,
    NotificationsModule,
    MerchantsModule,
    NfcModule,
    PaymentsModule,
    LedgerModule,
    WebhooksModule,
  ],
  controllers: [PublicController],
})
export class AppModule {}
