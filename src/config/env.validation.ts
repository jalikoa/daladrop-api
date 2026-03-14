import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsString, validateSync, IsOptional, IsIn } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  PORT: number;

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

  @IsString()
  REDIS_HOST: string;

  @IsNumber()
  REDIS_PORT: number;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRATION: string;

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

  @IsString()
  AFRICASTALKING_USERNAME: string;

  @IsString()
  AFRICASTALKING_API_KEY: string;

  @IsString()
  FIREBASE_PROJECT_ID: string;

  @IsString()
  FIREBASE_CLIENT_EMAIL: string;

  @IsString()
  FIREBASE_PRIVATE_KEY: string;

  @IsString()
  NFC_SECRET_KEY: string;

  @IsString()
  PUBLIC_URL: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig as any;
}
