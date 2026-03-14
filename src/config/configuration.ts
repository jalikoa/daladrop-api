import { IConfig } from './interfaces/config.interface';

export default (): IConfig => ({
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    environment: process.env.NODE_ENV || 'development',
    apiUrl: process.env.PUBLIC_URL || 'http://localhost:3000',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || '',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'nfc_payment_db',
    synchronize: process.env.DB_SYNC === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiration: process.env.JWT_EXPIRATION || '1d',
  },
  daraja: {
    consumerKey: process.env.DARAJA_CONSUMER_KEY || '',
    consumerSecret: process.env.DARAJA_CONSUMER_SECRET || '',
    paybill: process.env.DARAJA_PAYBILL || '',
    passkey: process.env.DARAJA_PASSKEY || '',
    environment: (process.env.DARAJA_ENV as 'sandbox' | 'production') || 'sandbox',
  },
  africastalking: {
    username: process.env.AFRICASTALKING_USERNAME || 'sandbox',
    apiKey: process.env.AFRICASTALKING_API_KEY || '',
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
  },
  nfc: {
    secretKey: process.env.NFC_SECRET_KEY || '9f6b8832e48d583ebbea82e38ac0fb1f1',
  },
});
