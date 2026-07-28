import { DynamicModule, Module, type Provider } from '@nestjs/common';
import { REDIS_CLIENT } from '../../platform/architecture/tokens/injection.tokens';
import type {
  RedisConnectionOptions,
  RedisDriver,
  RedisSleeper,
  RedisTimer,
} from './redis.types';
import { RedisClientService } from './redis-client.service';
import { RedisConnectionFactory } from './redis-connection.factory';
import { RedisHealthIndicator } from './redis.health.indicator';

export interface RedisModuleOptions extends RedisConnectionOptions {
  readonly driver?: RedisDriver;
  readonly factory?: RedisConnectionFactory;
  readonly sleeper?: RedisSleeper;
  readonly timer?: RedisTimer;
}

@Module({})
export class RedisInfrastructureModule {
  public static register(options: RedisModuleOptions = {}): DynamicModule {
    const provider: Provider = {
      provide: RedisClientService,
      useFactory: (): RedisClientService =>
        RedisInfrastructureModule.createClient(options),
    };
    return {
      module: RedisInfrastructureModule,
      providers: [
        provider,
        { provide: REDIS_CLIENT, useExisting: RedisClientService },
        RedisHealthIndicator,
      ],
      exports: [REDIS_CLIENT, RedisClientService, RedisHealthIndicator],
    };
  }

  public static registerAsync(options: {
    imports?: DynamicModule['imports'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inject?: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (...args: any[]) => RedisModuleOptions | Promise<RedisModuleOptions>;
  }): DynamicModule {
    const provider: Provider = {
      provide: RedisClientService,
      inject: options.inject ?? [],
      useFactory: async (...args: unknown[]): Promise<RedisClientService> => {
        const resolved = await options.useFactory(...args);
        return RedisInfrastructureModule.createClient(resolved);
      },
    };
    return {
      module: RedisInfrastructureModule,
      imports: options.imports ?? [],
      providers: [
        provider,
        { provide: REDIS_CLIENT, useExisting: RedisClientService },
        RedisHealthIndicator,
      ],
      exports: [REDIS_CLIENT, RedisClientService, RedisHealthIndicator],
    };
  }

  private static createClient(options: RedisModuleOptions): RedisClientService {
    const driver =
      options.driver ??
      (options.factory ?? new RedisConnectionFactory()).create(options).client;
    return new RedisClientService(
      driver,
      options,
      options.sleeper,
      options.timer,
    );
  }
}
