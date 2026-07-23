import { IConfig } from './interfaces/config.interface';

/**
 * Configuration factory function.
 * Maps environment variables to the strict IConfig interface.
 * Provides sensible defaults for local development where appropriate.
 */
export default (): IConfig => ({
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    environment: process.env.NODE_ENV || 'development',
    apiUrl: process.env.PUBLIC_URL || 'http://localhost:3000',
    name: process.env.APP_NAME || 'HMS API',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
  database: {
    type: process.env.DB_TYPE || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'hms_db',
    synchronize: process.env.DB_SYNC === 'true',
  },
  orm: {
    type: (process.env.ORM_TYPE as 'prisma' | 'typeorm') || 'prisma',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-dev-secret-change-in-production',
    expiration: process.env.JWT_EXPIRATION || '1d',
  },
  encryption: {
    secretKey: process.env.ENCRYPTION_SECRET_KEY || 'default-dev-encryption-key-32-chars!!',
  },
  daraja: {
    consumerKey: process.env.DARAJA_CONSUMER_KEY || '',
    consumerSecret: process.env.DARAJA_CONSUMER_SECRET || '',
    paybill: process.env.DARAJA_PAYBILL || '',
    passkey: process.env.DARAJA_PASSKEY || '',
    callbackUrl: process.env.DARAJA_CALLBACK_URL || '',
  },
  africastalking: {
    username: process.env.AFRICASTALKING_USERNAME || 'sandbox',
    apiKey: process.env.AFRICASTALKING_API_KEY || '',
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    /**
     * Replace literal \n characters with actual newlines for Firebase private keys.
     */
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@hms.local',
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    bucket: process.env.STORAGE_BUCKET || 'hms-documents',
    endpoint: process.env.STORAGE_ENDPOINT || undefined,
    accessKey: process.env.STORAGE_ACCESS_KEY || undefined,
    secretKey: process.env.STORAGE_SECRET_KEY || undefined,
  },
  observability: {
    logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    elasticsearch: {
      url: process.env.ELASTICSEARCH_URL || '',
      username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
      password: process.env.ELASTICSEARCH_PASSWORD || '',
    },
    logstash: {
      host: process.env.LOGSTASH_HOST || '',
      port: parseInt(process.env.LOGSTASH_PORT || '5000', 10),
    },
    metricsToken: process.env.METRICS_TOKEN || '',
    sentryDsn: process.env.SENTRY_DSN || undefined,
  },
});