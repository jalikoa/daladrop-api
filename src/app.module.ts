import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * Core Infrastructure Modules
 * These provide foundational capabilities (logging, metrics, config, health)
 * and are loaded first to ensure they are available to all domain modules.
 */
import { LoggerModule } from './modules/logger/logger.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { HealthModule } from './modules/health/health.module';
import { ConfigModule as AppConfigModule } from './config/config.module';

/**
 * Shared Domain Modules
 * Modules that provide cross-cutting concerns or global services
 * required by multiple features across the application.
 */
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { QueuesModule } from './modules/queues/queues.module';

/**
 * Feature Domain Modules
 * Specific business domains. Add new modules here as the system grows.
 */

@Module({
  imports: [
    /**
     * Global Configuration Module
     * Loads environment variables and makes them available application-wide.
     * isGlobal: true prevents the need to import ConfigModule in every feature module.
     */
    AppConfigModule.forRoot({
      isGlobal: true,
    }),

    /**
     * Core Observability Modules
     * Loaded before domain modules to ensure logger and metrics 
     * are available during the initialization of other services.
     */
    LoggerModule,
    MetricsModule,
    HealthModule,

    /**
     * Database Configuration
     * Dynamically adapts to the DB_TYPE environment variable (postgres, mysql, sqlite).
     * 
     * NOTE ON PRISMA: If your project uses Prisma (ORM_TYPE=prisma), remove this 
     * TypeOrmModule block entirely and import your global PrismaModule instead.
     * Prisma manages its own connection via prisma/schema.prisma.
     */
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (config: ConfigService) => ({
        type: (config.get<string>('DB_TYPE') || 'postgres') as any,
        host: config.get<string>('DB_HOST') || 'localhost',
        port: config.get<number>('DB_PORT') || 5432,
        username: config.get<string>('DB_USERNAME') || 'root',
        password: config.get<string>('DB_PASSWORD') || '',
        database: config.get<string>('DB_NAME') || 'api_db',
        autoLoadEntities: true,
        synchronize: false,
        logging: config.get<string>('NODE_ENV') !== 'production',
        extra: {
          connectionLimit: 20,
          waitForConnections: true,
          queueLimit: 0,
        },
      }),
      inject: [ConfigService],
    }),

    /**
     * Event Bus Configuration
     * Enables the internal NestJS event emitter for decoupled, 
     * asynchronous communication between modules.
     * 
     * wildcard: true is critical for modular systems. It allows modules 
     * to listen to patterns like 'user.*' or 'payment.*' without knowing 
     * the exact event names, preventing tight coupling between publishers and listeners.
     */
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    /**
     * Job Queue Configuration (Bull / Redis)
     * Provides a robust background job processing system.
     * Includes a retry strategy to handle temporary Redis disconnections gracefully.
     */
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('REDIS_HOST') || 'localhost',
          port: config.get<number>('REDIS_PORT') || 6379,
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          retryStrategy: (times: number) => {
            /**
             * Exponential backoff for Redis reconnection.
             * Prevents the app from crashing if Redis restarts or has a brief network hiccup.
             */
            return Math.min(times * 50, 2000);
          },
        },
      }),
      inject: [ConfigService],
    }),

    /**
     * Shared and Feature Domain Modules
     * Register all business logic modules here.
     * Order generally does not matter for imports, but grouping by 
     * "Shared/Cross-cutting" then "Feature" improves readability.
     */
    AuthModule,
    AuditModule,
    NotificationsModule,
    QueuesModule,
  ],
  controllers: [],
})
export class AppModule {}