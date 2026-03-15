import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from './config/config.module';

import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';

import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { NfcModule } from './modules/nfc/nfc.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

import { PublicController } from './interfaces/public/public.controller';

@Module({
  imports: [
    ConfigModule,

    /*
    ------------------------------------------------
    SINGLE DATABASE CONNECTION
    ------------------------------------------------
    */

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',

        host: config.get<string>('database.host') || config.get<string>('DB_HOST'),
        port: config.get<number>('database.port') || config.get<number>('DB_PORT'),

        username: config.get<string>('database.username') || config.get<string>('DB_USERNAME'),
        password: config.get<string>('database.password') || config.get<string>('DB_PASSWORD'),

        database: config.get<string>('database.name') || config.get<string>('DB_NAME'),

        autoLoadEntities: true,
        synchronize: false,

        logging: false,

        /*
        --------------------------------------------
        CONNECTION POOLING
        --------------------------------------------
        */

        extra: {
          connectionLimit: 20,   // max simultaneous connections
          waitForConnections: true,
          queueLimit: 0,
        },
      }),
      inject: [ConfigService],
    }),

    /*
    ------------------------------------------------
    EVENT BUS
    ------------------------------------------------
    */

    EventEmitterModule.forRoot(),

    /*
    ------------------------------------------------
    JOB QUEUES
    ------------------------------------------------
    */

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          host:
            config.get<string>('redis.host') ||
            config.get<string>('REDIS_HOST'),

          port:
            config.get<number>('redis.port') ||
            config.get<number>('REDIS_PORT'),
        },
      }),
      inject: [ConfigService],
    }),

    /*
    ------------------------------------------------
    DOMAIN MODULES
    ------------------------------------------------
    */

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