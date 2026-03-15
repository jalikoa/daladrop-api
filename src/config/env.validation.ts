import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsIn,
  validateSync,
  MinLength,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production  = 'production',
  Test        = 'test',
}

class EnvironmentVariables {
  // ── App ───────────────────────────────────────────────────────────────────
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

  // ── Database ──────────────────────────────────────────────────────────────
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

  // ── Redis ─────────────────────────────────────────────────────────────────
  @IsString()
  REDIS_HOST: string;

  @IsNumber()
  REDIS_PORT: number;

  // ── JWT ───────────────────────────────────────────────────────────────────
  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRATION: string;

  // ── Daraja ────────────────────────────────────────────────────────────────
  @IsString()
  DARAJA_CONSUMER_KEY: string;

  @IsString()
  DARAJA_CONSUMER_SECRET: string;

  @IsString()
  DARAJA_PAYBILL: string;

  @IsString()
  DARAJA_PASSKEY: string;

  @IsIn(['sandbox', 'production'] as const)
  DARAJA_ENV: 'sandbox' | 'production';

  // ── Africa's Talking ──────────────────────────────────────────────────────
  @IsString()
  AFRICASTALKING_USERNAME: string;

  @IsString()
  AFRICASTALKING_API_KEY: string;

  // ── Firebase ──────────────────────────────────────────────────────────────
  @IsString()
  FIREBASE_PROJECT_ID: string;

  @IsString()
  FIREBASE_CLIENT_EMAIL: string;

  @IsString()
  FIREBASE_PRIVATE_KEY: string;

  // ── NFC ───────────────────────────────────────────────────────────────────
  @IsString()
  @MinLength(32, { message: 'NFC_SECRET_KEY must be exactly 32 characters for AES-256' })
  NFC_SECRET_KEY: string;

  // ── Observability — all optional so the app starts without them in dev ────

  @IsString()
  @IsOptional()
  LOG_LEVEL?: string;

  /** When set, Winston sends logs directly to Elasticsearch */
  @IsString()
  @IsOptional()
  ELASTICSEARCH_URL?: string;

  @IsString()
  @IsOptional()
  ELASTICSEARCH_USERNAME?: string;

  @IsString()
  @IsOptional()
  ELASTICSEARCH_PASSWORD?: string;

  /** When set, Winston sends logs to Logstash over TCP */
  @IsString()
  @IsOptional()
  LOGSTASH_HOST?: string;

  @IsNumber()
  @IsOptional()
  LOGSTASH_PORT?: number;

  /**
   * Bearer token Prometheus sends when scraping GET /metrics.
   * When absent in dev, the /metrics endpoint requires no auth.
   * Must be set in production.
   */
  @IsString()
  @IsOptional()
  METRICS_TOKEN?: string;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validated as any;
}