import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';

import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PublicController } from './interfaces/public/public.controller';
import { EncryptionService } from './common/security/encryption.service';

/**
 * Scaffold cross-cutting modules currently in use.
 * Domain feature modules are generated later via `src/modules/module.sh`.
 */
import { LoggerModule } from './modules/logger/logger.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { HealthModule } from './modules/health/health.module';
import { RuntimeConfigModule } from './modules/config/config.module';
import { IdentityModule } from './modules/identity/identity.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { CustomerModule } from './modules/customer/customer.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { EventsModule } from './modules/events/events.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { LogisticsModule } from './modules/logistics/logistics.module';
import { OrdersModule } from './modules/orders/orders.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { TransportModule } from './modules/transport/transport.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OperationsModule } from './modules/operations/operations.module';
import { RealtimeModule } from './platform/realtime/realtime.module';
import {
  InMemoryRateLimitStore,
  RateLimitService,
} from './platform/security/http/rate-limit.service';
import { RateLimitGuard } from './platform/security/http/rate-limit.guard';

/**
 * Application composition root for the reusable API scaffold.
 *
 * Kept modules:
 * - LoggerModule — structured logging
 * - MetricsModule — Prometheus HTTP metrics
 * - HealthModule — liveness / readiness probes
 * - RuntimeConfigModule — non-secret runtime metadata
 * - RealtimeModule — platform Socket.IO / realtime facade (`src/platform/realtime`)
 *
 * `FoundationModule` (`src/infrastructure/foundation`) is the reusable
 * production composition API for future apps. It is intentionally **not**
 * imported here: this scaffold still boots via legacy `src/modules` logger /
 * metrics / health registrations. Wiring Foundation alongside those modules
 * would dual-register observability and HTTP pipeline concerns. Migrate by
 * replacing the modules/* imports with `FoundationModule.register(...)`.
 *
 * Business domains are intentionally absent. Generate them with:
 *   yarn module:generate <domain-name>
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRoot(),
    RealtimeModule.register({ allowInMemory: true }),

    LoggerModule,
    MetricsModule,
    HealthModule,
    RuntimeConfigModule,
    IdentityModule,
    AuthorizationModule,
    CustomerModule,
    MerchantsModule,
    CatalogModule,
    ComplianceModule,
    PaymentsModule,
    AccountingModule,
    WalletsModule,
    LogisticsModule,
    OrdersModule,
    DiscoveryModule,
    EventsModule,
    TransportModule,
    NotificationsModule,
    OperationsModule,

    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('redis.host') || 'localhost',
          port: config.get<number>('redis.port') || 6379,
          password: config.get<string>('redis.password') || undefined,
          retryStrategy: (times: number) => Math.min(times * 50, 2000),
        },
      }),
    }),
  ],
  controllers: [AppController, PublicController],
  providers: [
    AppService,
    EncryptionService,
    {
      provide: RateLimitService,
      useFactory: () =>
        new RateLimitService(
          new InMemoryRateLimitStore({ maxEntries: 50_000 }),
        ),
    },
    {
      provide: RateLimitGuard,
      useFactory: (limiter: RateLimitService, config: ConfigService) =>
        new RateLimitGuard(
          limiter,
          config.get<number>('rateLimit.limit') ?? 120,
          config.get<number>('rateLimit.windowMs') ?? 60_000,
        ),
      inject: [RateLimitService, ConfigService],
    },
    { provide: APP_GUARD, useExisting: RateLimitGuard },
  ],
  exports: [EncryptionService],
})
export class AppModule {}
