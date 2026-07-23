/**
 * Global Application Configuration Interface
 * 
 * Defines the strict shape of the environment configuration.
 * This ensures type safety and prevents runtime crashes due to 
 * missing or malformed environment variables.
 */
export interface IConfig {
  /**
   * Application-level settings
   */
  app: {
    port: number;
    environment: string;
    apiUrl: string;
    name: string;
    corsOrigins: string[];
  };

  /**
   * Database connection settings
   */
  database: {
    type: string;
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
    synchronize: boolean;
  };

  /**
   * ORM selection (prisma or typeorm)
   */
  orm: {
    type: 'prisma' | 'typeorm';
  };

  /**
   * Redis configuration for BullMQ queues and caching
   */
  redis: {
    host: string;
    port: number;
    password?: string;
  };

  /**
   * JSON Web Token settings for authentication
   */
  jwt: {
    secret: string;
    expiration: string;
  };

  /**
   * Cryptographic settings for sensitive data encryption
   */
  encryption: {
    secretKey: string;
  };

  /**
   * Safaricom Daraja (M-Pesa) API credentials
   */
  daraja: {
    consumerKey: string;
    consumerSecret: string;
    paybill: string;
    passkey: string;
    callbackUrl: string;
  };

  /**
   * Africa's Talking API credentials for SMS notifications
   */
  africastalking: {
    username: string;
    apiKey: string;
  };

  /**
   * Firebase Admin SDK credentials for Push Notifications
   */
  firebase: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  };

  /**
   * SMTP settings for Email notifications
   */
  email: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };

  /**
   * Object storage settings (e.g., Supabase Storage, AWS S3)
   * Used for patient documents, radiology images, and profile pictures.
   */
  storage: {
    provider: string;
    bucket: string;
    endpoint?: string;
    accessKey?: string;
    secretKey?: string;
  };

  /**
   * Observability and logging settings
   */
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