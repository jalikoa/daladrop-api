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
    DATABASE CONNECTIONS (Bounded Contexts)
    ------------------------------------------------
    */

    // Identity Domain
    TypeOrmModule.forRootAsync({
      name: 'identity',
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('database.host') || config.get<string>('DB_HOST'),
        port: config.get<number>('database.port') || config.get<number>('DB_PORT'),
        username: config.get<string>('database.username') || config.get<string>('DB_USERNAME'),
        password: config.get<string>('database.password') || config.get<string>('DB_PASSWORD'),
        database: 'identity',
        autoLoadEntities: true,
        synchronize: false,
        logging: false,
      }),
      inject: [ConfigService],
    }),

    // Merchant Domain
    TypeOrmModule.forRootAsync({
      name: 'merchant',
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('database.host') || config.get<string>('DB_HOST'),
        port: config.get<number>('database.port') || config.get<number>('DB_PORT'),
        username: config.get<string>('database.username') || config.get<string>('DB_USERNAME'),
        password: config.get<string>('database.password') || config.get<string>('DB_PASSWORD'),
        database: 'merchant',
        autoLoadEntities: true,
        synchronize: false,
        logging: false,
      }),
      inject: [ConfigService],
    }),

    // Payments Domain
    TypeOrmModule.forRootAsync({
      name: 'payments',
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('database.host') || config.get<string>('DB_HOST'),
        port: config.get<number>('database.port') || config.get<number>('DB_PORT'),
        username: config.get<string>('database.username') || config.get<string>('DB_USERNAME'),
        password: config.get<string>('database.password') || config.get<string>('DB_PASSWORD'),
        database: 'payments',
        autoLoadEntities: true,
        synchronize: false,
        logging: false,
      }),
      inject: [ConfigService],
    }),

    // Ledger Domain
    TypeOrmModule.forRootAsync({
      name: 'ledger',
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('database.host') || config.get<string>('DB_HOST'),
        port: config.get<number>('database.port') || config.get<number>('DB_PORT'),
        username: config.get<string>('database.username') || config.get<string>('DB_USERNAME'),
        password: config.get<string>('database.password') || config.get<string>('DB_PASSWORD'),
        database: 'ledger',
        autoLoadEntities: true,
        synchronize: false,
        logging: false,
      }),
      inject: [ConfigService],
    }),

    // Notifications Domain
    TypeOrmModule.forRootAsync({
      name: 'notifications',
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('database.host') || config.get<string>('DB_HOST'),
        port: config.get<number>('database.port') || config.get<number>('DB_PORT'),
        username: config.get<string>('database.username') || config.get<string>('DB_USERNAME'),
        password: config.get<string>('database.password') || config.get<string>('DB_PASSWORD'),
        database: 'notifications',
        autoLoadEntities: true,
        synchronize: false,
        logging: false,
      }),
      inject: [ConfigService],
    }),

    // Audit Domain
    TypeOrmModule.forRootAsync({
      name: 'audit',
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('database.host') || config.get<string>('DB_HOST'),
        port: config.get<number>('database.port') || config.get<number>('DB_PORT'),
        username: config.get<string>('database.username') || config.get<string>('DB_USERNAME'),
        password: config.get<string>('database.password') || config.get<string>('DB_PASSWORD'),
        database: 'audit',
        autoLoadEntities: true,
        synchronize: false,
        logging: false,
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