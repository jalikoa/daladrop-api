import { DataSource } from 'typeorm';
import { InitialSchema1773464660676 } from './database/migrations/1773464660676-InitialSchema';

export const AppDataSource = new DataSource({
  type: 'mysql', // or 'mysql'
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: '',
  database: 'nfc_db',
  entities: [__dirname + '/entities/**/*{.js,.ts}'],
  migrations: [InitialSchema1773464660676], // or [__dirname + '/migrations/**/*{.js,.ts}']
  migrationsRun: false,
  synchronize: false,
  logging: true,
});