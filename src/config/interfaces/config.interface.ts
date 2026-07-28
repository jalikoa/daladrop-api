/**
 * Global Application Configuration Interface.
 *
 * Defines the typed shape of environment configuration so NestJS services
 * receive compile-time safety instead of untyped `process.env` access.
 * Domain-specific integrations belong in feature modules, not here.
 */
export interface IConfig {
  app: {
    port: number;
    environment: string;
    apiUrl: string;
    name: string;
    corsOrigins: string[];
    globalPrefix: string;
  };

  database: {
    type: string;
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
    /** Prisma connection string (required when ORM_TYPE=prisma). */
    url?: string;
    synchronize: boolean;
  };

  orm: {
    type: 'prisma' | 'typeorm';
  };

  redis: {
    host: string;
    port: number;
    password?: string;
  };

  jwt: {
    secret: string;
    expiration: string;
  };

  encryption: {
    secretKey: string;
  };

  /**
   * Optional generic external API credentials.
   * Add provider-specific blocks in feature modules as needed.
   */
  externalService: {
    apiKey: string;
    apiSecret: string;
    baseUrl: string;
    callbackUrl: string;
  };

  /**
   * Optional push-notification provider credentials (Firebase, OneSignal, etc.).
   */
  push: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  };

  email: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };

  storage: {
    provider: string;
    bucket: string;
    endpoint?: string;
    accessKey?: string;
    secretKey?: string;
  };

  /** Identity / OTP / session policy (canonical AUTH_* mapping). */
  auth: {
    accessTtlSeconds: number;
    refreshTtlSeconds: number;
    sessionAbsoluteTtlSeconds: number;
    otpTtlSeconds: number;
    otpResendCooldownSeconds: number;
    otpMaxAttempts: number;
    otpSendsPerWindow: number;
    otpSendWindowSeconds: number;
    loginAttemptsPerWindow: number;
    loginWindowSeconds: number;
    humanChallengeRequired: boolean;
    emailProvider: string;
    smsProvider: string;
    totpIssuer: string;
    otpConsoleLog: boolean;
    otpForceSend: boolean;
    otpSkipSend: boolean;
    password: {
      bcryptRounds: number;
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumber: boolean;
      requireSymbol: boolean;
    };
    lockout: {
      maxFailures: number;
      windowMs: number;
      lockoutMs: number;
    };
  };

  /** SMS providers (Africa's Talking + generic HTTP fallback). */
  sms: {
    at: {
      apiKey: string;
      username: string;
      environment: string;
      baseUrl: string;
      senderId: string;
      shortcode: string;
    };
    http: {
      url: string;
      token: string;
    };
  };

  /** Global HTTP RateLimitGuard defaults. */
  rateLimit: {
    limit: number;
    windowMs: number;
  };

  observability: {
    logLevel: string;
    elasticsearch: {
      url: string;
      username: string;
      password: string;
    };
    logstash: {
      host: string;
      port: number;
    };
    metricsToken: string;
    sentryDsn?: string;
  };
}
