import { DataSource } from 'typeorm';
import { config } from 'dotenv';

/**
 * Load environment variables from .env file.
 * This is required because TypeORM CLI runs this file directly,
 * bypassing NestJS's ConfigModule initialization.
 */
config();

export const AppDataSource = new DataSource({
  /**
   * Database type
   * Supports 'postgres', 'mysql', 'sqlite', etc.
   * Driven by environment variables for maximum flexibility.
   */
  type: (process.env.DB_TYPE as any) || 'postgres',

  /**
   * Database connection credentials
   * Defaults provided for local dev, but always overridden by .env in real environments.
   */
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hms_db',

  /**
   * Entity and Migration paths
   * Using glob patterns ensures new modules and migrations are 
   * automatically picked up by TypeORM without requiring manual file edits.
   */
  entities: [__dirname + '/../modules/**/entities/*{.js,.ts}'],
  migrations: [__dirname + '/migrations/**/*{.js,.ts}'],

  /**
   * Migration and Sync settings
   * synchronize MUST be false to prevent accidental schema destruction.
   * migrationsRun is false to ensure migrations are executed explicitly 
   * via CLI (e.g., npm run migration:run) for safe, version-controlled deployments.
   */
  synchronize: false,
  migrationsRun: false,

  /**
   * Logging configuration
   * Enable SQL logging only in non-production environments to reduce 
   * noise and prevent sensitive data exposure in production logs.
   */
  logging: process.env.NODE_ENV !== 'production',
});