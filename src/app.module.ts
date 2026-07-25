import { Module } from '@nestjs/common';
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

/**
 * Application composition root for the reusable API scaffold.
 *
 * Kept modules:
 * - LoggerModule — structured logging
 * - MetricsModule — Prometheus HTTP metrics
 * - HealthModule — liveness / readiness probes
 * - RuntimeConfigModule — non-secret runtime metadata
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

    LoggerModule,
    MetricsModule,
    HealthModule,
    RuntimeConfigModule,

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
  providers: [AppService, EncryptionService],
  exports: [EncryptionService],
})
export class AppModule {}
