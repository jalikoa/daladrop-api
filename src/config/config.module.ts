import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { validate } from './env.validation';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      ignoreEnvFile: false,
      envFilePath: '.env',
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
