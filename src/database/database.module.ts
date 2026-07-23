import { Module, DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppDataSource } from './typeorm.config';

/**
 * Database Module
 * 
 * Dynamically configures the database connection based on the ORM_TYPE environment variable.
 * Supports both TypeORM and Prisma, allowing you to switch between them without code changes.
 * 
 * Usage:
 * - Set ORM_TYPE=typeorm in .env to use TypeORM
 * - Set ORM_TYPE=prisma in .env to use Prisma (requires PrismaModule to be imported separately)
 */
@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    const ormType = process.env.ORM_TYPE || 'typeorm';

    if (ormType === 'prisma') {
      /**
       * Prisma Mode
       * When ORM_TYPE=prisma, we return an empty module.
       * The PrismaModule (which you should create separately) handles its own connection.
       * This keeps the database module truly ORM-agnostic.
       */
      return {
        module: DatabaseModule,
        imports: [],
      };
    }

    /**
     * TypeORM Mode (Default)
     * When ORM_TYPE=typeorm (or not set), we configure TypeORM using the AppDataSource.
     * This uses forRootAsync to inject ConfigService and read environment variables at runtime.
     */
    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            type: configService.get<string>('database.type') as any,
            host: configService.get<string>('database.host'),
            port: configService.get<number>('database.port'),
            username: configService.get<string>('database.username'),
            password: configService.get<string>('database.password'),
            database: configService.get<string>('database.name'),
            entities: [__dirname + '/../modules/**/entities/*{.js,.ts}'],
            migrations: [__dirname + '/migrations/**/*{.js,.ts}'],
            synchronize: configService.get<boolean>('database.synchronize'),
            logging: configService.get<string>('app.environment') !== 'production',
          }),
          inject: [ConfigService],
        }),
      ],
    };
  }
}