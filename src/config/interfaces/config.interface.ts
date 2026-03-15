export interface IConfig {
  app: {
    port: number;
    environment: string;
    apiUrl: string;
    name: string;
    corsOrigins: string[];
  };
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
    synchronize: boolean;
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
  daraja: {
    consumerKey: string;
    consumerSecret: string;
    paybill: string;
    passkey: string;
    environment: 'sandbox' | 'production';
  };
  africastalking: {
    username: string;
    apiKey: string;
  };
  firebase: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  };
  nfc: {
    secretKey: string;
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
  };
}