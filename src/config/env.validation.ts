import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

enum DbType {
  Postgres = 'postgres',
  Mysql = 'mysql',
  Sqlite = 'sqlite',
}

enum OrmType {
  Prisma = 'prisma',
  Typeorm = 'typeorm',
}

class EnvironmentVariables {
  /**
   * Application Settings
   */
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  PORT: number;

  @IsString()
  @IsOptional()
  APP_NAME?: string;

  @IsString()
  @IsOptional()
  PUBLIC_URL?: string;

  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  /**
   * Database & ORM Settings
   */
  @IsEnum(DbType)
  DB_TYPE: DbType;

  @IsString()
  DB_HOST: string;

  @IsNumber()
  DB_PORT: number;

  @IsString()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_NAME: string;

  @IsBoolean()
  @IsOptional()
  DB_SYNC?: boolean;

  @IsEnum(OrmType)
  ORM_TYPE: OrmType;

  /**
   * Redis Settings
   */
  @IsString()
  REDIS_HOST: string;

  @IsNumber()
  REDIS_PORT: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  /**
   * Authentication Settings
   */
  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRATION: string;

  /**
   * Encryption Settings
   */
  @IsString()
  ENCRYPTION_SECRET_KEY: string;

  /**
   * Daraja (M-Pesa) Settings
   */
  @IsString()
  @IsOptional()
  DARAJA_CONSUMER_KEY?: string;

  @IsString()
  @IsOptional()
  DARAJA_CONSUMER_SECRET?: string;

  @IsString()
  @IsOptional()
  DARAJA_PAYBILL?: string;

  @IsString()
  @IsOptional()
  DARAJA_PASSKEY?: string;

  @IsString()
  @IsOptional()
  DARAJA_CALLBACK_URL?: string;

  /**
   * Notification Settings (SMS, Push, Email)
   */
  @IsString()
  @IsOptional()
  AFRICASTALKING_USERNAME?: string;

  @IsString()
  @IsOptional()
  AFRICASTALKING_API_KEY?: string;

  @IsString()
  @IsOptional()
  FIREBASE_PROJECT_ID?: string;

  @IsString()
  @IsOptional()
  FIREBASE_CLIENT_EMAIL?: string;

  @IsString()
  @IsOptional()
  FIREBASE_PRIVATE_KEY?: string;

  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsNumber()
  @IsOptional()
  SMTP_PORT?: number;

  @IsBoolean()
  @IsOptional()
  SMTP_SECURE?: boolean;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  @IsString()
  @IsOptional()
  SMTP_FROM?: string;

  /**
   * Storage Settings
   */
  @IsString()
  @IsOptional()
  STORAGE_PROVIDER?: string;

  @IsString()
  @IsOptional()
  STORAGE_BUCKET?: string;

  @IsString()
  @IsOptional()
  STORAGE_ENDPOINT?: string;

  @IsString()
  @IsOptional()
  STORAGE_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  STORAGE_SECRET_KEY?: string;

  /**
   * Observability Settings
   */
  @IsString()
  @IsOptional()
  LOG_LEVEL?: string;

  @IsString()
  @IsOptional()
  ELASTICSEARCH_URL?: string;

  @IsString()
  @IsOptional()
  ELASTICSEARCH_USERNAME?: string;

  @IsString()
  @IsOptional()
  ELASTICSEARCH_PASSWORD?: string;

  @IsString()
  @IsOptional()
  LOGSTASH_HOST?: string;

  @IsNumber()
  @IsOptional()
  LOGSTASH_PORT?: number;

  @IsString()
  @IsOptional()
  METRICS_TOKEN?: string;

  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;
}

/**
 * Validates the environment variables against the EnvironmentVariables class.
 * Throws an error with detailed validation messages if any required variables 
 * are missing or invalid, preventing the app from starting in a broken state.
 */
export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}