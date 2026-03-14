export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  synchronize: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export interface JwtConfig {
  secret: string;
  expiration: string;
}

export interface DarajaConfig {
  consumerKey: string;
  consumerSecret: string;
  paybill: string;
  passkey: string;
  environment: 'sandbox' | 'production';
}

export interface AfricaTalkingConfig {
  username: string;
  apiKey: string;
}

export interface FirebaseConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export interface NfcConfig {
  secretKey: string;
}

export interface AppConfig {
  port: number;
  environment: string;
  apiUrl: string;
}

export interface IConfig {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JwtConfig;
  daraja: DarajaConfig;
  africastalking: AfricaTalkingConfig;
  firebase: FirebaseConfig;
  nfc: NfcConfig;
}
