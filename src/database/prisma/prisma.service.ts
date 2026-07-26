import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma Service.
 *
 * Extends PrismaClient and hooks into NestJS lifecycle events so the
 * connection opens on boot and closes cleanly on shutdown.
 * Available globally when `ORM_TYPE=prisma`.
 *
 * For client extensions (soft-delete, row-level tenancy, etc.) prefer
 * composing them at bootstrap once your schema conventions are settled:
 *
 * ```typescript
 * const prisma = app.get(PrismaService).$extends({ ... });
 * ```
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV !== 'production'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Prisma database connection established');
    } catch (error) {
      this.logger.error(
        'Failed to establish Prisma database connection',
        error,
      );
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.log('Prisma database connection closed');
    } catch (error) {
      this.logger.error(
        'Error while closing Prisma database connection',
        error,
      );
    }
  }
}
