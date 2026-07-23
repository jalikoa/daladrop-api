import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma Service
 * 
 * Extends PrismaClient and implements NestJS lifecycle hooks to ensure 
 * the database connection is properly opened when the application starts 
 * and gracefully closed during shutdown.
 * 
 * This service is globally available throughout the application when 
 * ORM_TYPE=prisma is set in the environment.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      /**
       * Enable query logging in non-production environments for debugging.
       * In production, only log errors to avoid performance overhead and 
       * sensitive data exposure in logs.
       */
      log: process.env.NODE_ENV !== 'production' 
        ? ['query', 'info', 'warn', 'error'] 
        : ['error'],
    });
  }

  /**
   * Lifecycle hook: Called when the NestJS module initializes.
   * Establishes the database connection before the application starts handling requests.
   */
  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma database connection established successfully');
    } catch (error) {
      this.logger.error('Failed to establish Prisma database connection', error);
      throw error;
    }
  }

  /**
   * Lifecycle hook: Called when the NestJS module is being destroyed.
   * Gracefully closes the database connection to prevent connection leaks 
   * and ensure clean shutdown.
   */
  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Prisma database connection closed successfully');
    } catch (error) {
      this.logger.error('Error while closing Prisma database connection', error);
    }
  }

  /**
   * Enable Prisma Client Extensions (optional).
   * This method can be used to add custom logic, middleware, or result transformations.
   * 
   * Example usage:
   * ```typescript
   * const extendedPrisma = prismaService.enableSoftDelete();
   * ```
   */
  enableSoftDelete() {
    return this.$extends({
      query: {
        $allModels: {
          async delete({ args, query }) {
            args.where = { ...args.where, deletedAt: null };
            const result = await query(args);
            return result;
          },
          async update({ args, query }) {
            args.where = { ...args.where, deletedAt: null };
            return query(args);
          },
        },
      },
    });
  }
}