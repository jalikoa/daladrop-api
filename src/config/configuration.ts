import { IConfig } from './interfaces/config.interface';

function positiveIntEnv(key: string, fallback: number): number {
  const parsed = Number(process.env[key]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function boolEnv(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (value === undefined || value === '') return defaultValue;
  return value === 'true';
}

function boolEnvDefaultTrue(key: string): boolean {
  const value = process.env[key];
  if (value === undefined || value === '') return true;
  return value !== 'false';
}

/**
 * Configuration factory.
 * Maps environment variables onto the strict {@link IConfig} interface and
 * supplies safe local-development defaults where appropriate.
 * JWT / encryption secrets have no fallbacks — boot must fail closed.
 */
export default (): IConfig => {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  const encryptionSecret = process.env.ENCRYPTION_SECRET_KEY?.trim();
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required');
  }
  if (!encryptionSecret) {
    throw new Error('ENCRYPTION_SECRET_KEY is required');
  }

  const atUser = (process.env.AT_USERNAME || '').trim();
  const atEnv = (process.env.AT_ENVIRONMENT || '').trim().toLowerCase();
  const atBaseDefault =
    atEnv === 'sandbox' || atUser === 'sandbox'
      ? 'https://api.sandbox.africastalking.com'
      : 'https://api.africastalking.com';

  return {
    app: {
      port: parseInt(process.env.PORT || '3000', 10),
      environment: process.env.NODE_ENV || 'development',
      apiUrl: process.env.PUBLIC_URL || 'http://localhost:3000',
      name: process.env.APP_NAME || 'api',
      corsOrigins: process.env.CORS_ORIGINS?.split(',')
        .map((o) => o.trim())
        .filter(Boolean) || ['http://localhost:3000'],
      globalPrefix: process.env.API_GLOBAL_PREFIX || '',
    },
    database: {
      type: process.env.DB_TYPE || process.env.DATABASE_TYPE || 'postgres',
      host: process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost',
      port: parseInt(
        process.env.DB_PORT || process.env.DATABASE_PORT || '5432',
        10,
      ),
      username:
        process.env.DB_USERNAME ||
        process.env.DATABASE_USER ||
        process.env.DATABASE_USERNAME ||
        process.env.DB_USER ||
        'postgres',
      password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || '',
      name: process.env.DB_NAME || process.env.DATABASE_NAME || 'app_db',
      url: process.env.DATABASE_URL || undefined,
      synchronize: process.env.DB_SYNC === 'true',
    },
    orm: {
      type:
        ((process.env.ORM_PROVIDER || process.env.ORM_TYPE) as
          | 'prisma'
          | 'typeorm') || 'prisma',
    },
    redis: {
      // Canonical default matches RedisInfrastructureModule / identity (IPv4 loopback).
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    },
    jwt: {
      secret: jwtSecret,
      expiration: process.env.JWT_EXPIRATION || '1d',
    },
    encryption: {
      secretKey: encryptionSecret,
    },
    externalService: {
      apiKey: process.env.EXTERNAL_SERVICE_API_KEY || '',
      apiSecret: process.env.EXTERNAL_SERVICE_API_SECRET || '',
      baseUrl: process.env.EXTERNAL_SERVICE_BASE_URL || '',
      callbackUrl: process.env.EXTERNAL_SERVICE_CALLBACK_URL || '',
    },
    push: {
      projectId: process.env.PUSH_PROVIDER_PROJECT_ID || '',
      clientEmail: process.env.PUSH_PROVIDER_CLIENT_EMAIL || '',
      privateKey: (process.env.PUSH_PROVIDER_PRIVATE_KEY || '').replace(
        /\\n/g,
        '\n',
      ),
    },
    email: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || 'noreply@example.com',
    },
    storage: {
      provider: process.env.STORAGE_PROVIDER || 's3',
      bucket: process.env.STORAGE_BUCKET || 'app-documents',
      endpoint: process.env.STORAGE_ENDPOINT || undefined,
      accessKey: process.env.STORAGE_ACCESS_KEY || undefined,
      secretKey: process.env.STORAGE_SECRET_KEY || undefined,
    },
    auth: {
      accessTtlSeconds: positiveIntEnv('AUTH_ACCESS_TTL_SECONDS', 15 * 60),
      refreshTtlSeconds: positiveIntEnv(
        'AUTH_REFRESH_TTL_SECONDS',
        30 * 24 * 60 * 60,
      ),
      sessionAbsoluteTtlSeconds: positiveIntEnv(
        'AUTH_SESSION_ABSOLUTE_TTL_SECONDS',
        90 * 24 * 60 * 60,
      ),
      otpTtlSeconds: positiveIntEnv('AUTH_OTP_TTL_SECONDS', 5 * 60),
      otpResendCooldownSeconds: positiveIntEnv(
        'AUTH_OTP_RESEND_COOLDOWN_SECONDS',
        60,
      ),
      otpMaxAttempts: positiveIntEnv('AUTH_OTP_MAX_ATTEMPTS', 5),
      otpSendsPerWindow: positiveIntEnv('AUTH_OTP_SENDS_PER_WINDOW', 5),
      otpSendWindowSeconds: positiveIntEnv(
        'AUTH_OTP_SEND_WINDOW_SECONDS',
        15 * 60,
      ),
      loginAttemptsPerWindow: positiveIntEnv(
        'AUTH_LOGIN_ATTEMPTS_PER_WINDOW',
        10,
      ),
      loginWindowSeconds: positiveIntEnv('AUTH_LOGIN_WINDOW_SECONDS', 15 * 60),
      humanChallengeRequired: boolEnv('AUTH_HUMAN_CHALLENGE_REQUIRED'),
      emailProvider: process.env.AUTH_EMAIL_PROVIDER || 'smtp',
      smsProvider: process.env.AUTH_SMS_PROVIDER || 'http-sms',
      totpIssuer: process.env.AUTH_TOTP_ISSUER || 'DalaDrop',
      otpConsoleLog: boolEnv('AUTH_OTP_CONSOLE_LOG'),
      otpForceSend: boolEnv('AUTH_OTP_FORCE_SEND'),
      otpSkipSend: boolEnv('AUTH_OTP_SKIP_SEND'),
      password: {
        bcryptRounds: positiveIntEnv('AUTH_PASSWORD_BCRYPT_ROUNDS', 12),
        minLength: positiveIntEnv('AUTH_PASSWORD_MIN_LENGTH', 6),
        requireUppercase: boolEnvDefaultTrue('AUTH_PASSWORD_REQUIRE_UPPERCASE'),
        requireLowercase: boolEnvDefaultTrue('AUTH_PASSWORD_REQUIRE_LOWERCASE'),
        requireNumber: boolEnvDefaultTrue('AUTH_PASSWORD_REQUIRE_NUMBER'),
        requireSymbol: boolEnvDefaultTrue('AUTH_PASSWORD_REQUIRE_SYMBOL'),
      },
      lockout: {
        maxFailures: positiveIntEnv('AUTH_LOCKOUT_FAILURES', 5),
        windowMs: positiveIntEnv('AUTH_LOCKOUT_WINDOW_MS', 900_000),
        lockoutMs: positiveIntEnv('AUTH_LOCKOUT_MS', 900_000),
      },
    },
    sms: {
      at: {
        apiKey: (process.env.AT_API_KEY || '').trim(),
        username: atUser,
        environment: atEnv,
        baseUrl: (process.env.AT_BASE_URL || '').trim() || atBaseDefault,
        senderId: (process.env.AT_SENDER_ID || '').trim(),
        shortcode: (process.env.AT_SHORTCODE || '').trim(),
      },
      http: {
        url: (process.env.SMS_PROVIDER_URL || '').trim(),
        token: (process.env.SMS_PROVIDER_TOKEN || '').trim(),
      },
    },
    rateLimit: {
      limit: positiveIntEnv('HTTP_RATE_LIMIT', 120),
      windowMs: positiveIntEnv('HTTP_RATE_LIMIT_WINDOW_MS', 60_000),
    },
    observability: {
      logLevel:
        process.env.LOG_LEVEL ||
        (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      elasticsearch: {
        url: process.env.ELASTICSEARCH_URL || '',
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || '',
      },
      logstash: {
        host: process.env.LOGSTASH_HOST || '',
        // Align with Winston LogstashTcpTransport default (Beats-style 5044).
        port: parseInt(process.env.LOGSTASH_PORT || '5044', 10),
      },
      metricsToken: process.env.METRICS_TOKEN || '',
      sentryDsn: process.env.SENTRY_DSN || undefined,
    },
  };
};
