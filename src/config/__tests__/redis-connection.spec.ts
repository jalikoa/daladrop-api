import { ConfigService } from '@nestjs/config';
import {
  redisConnectionFromConfig,
  resolveRedisRuntimeConnection,
} from '../redis-connection';

describe('redisConnection helpers', () => {
  it('parses redis:// without TLS', () => {
    expect(
      resolveRedisRuntimeConnection({
        url: 'redis://:secret@cache.example:6380/2',
      }),
    ).toEqual({
      host: 'cache.example',
      port: 6380,
      db: 2,
      password: 'secret',
    });
  });

  it('parses rediss:// with username + TLS (Render external)', () => {
    expect(
      resolveRedisRuntimeConnection({
        url: 'rediss://red-abc123:p%40ss@oregon-kv.render.com:6379',
      }),
    ).toEqual({
      host: 'oregon-kv.render.com',
      port: 6379,
      db: 0,
      username: 'red-abc123',
      password: 'p@ss',
      tls: {},
    });
  });

  it('falls back to discrete host/port when URL absent', () => {
    expect(
      resolveRedisRuntimeConnection({
        host: '127.0.0.1',
        port: 6379,
        password: 'x',
      }),
    ).toEqual({
      host: '127.0.0.1',
      port: 6379,
      db: 0,
      password: 'x',
    });
  });

  it('reads nested redis.* from ConfigService', () => {
    const config = new ConfigService({
      redis: {
        url: 'rediss://user:pass@remote:6379/1',
      },
    });
    expect(redisConnectionFromConfig(config, { maxRetriesPerRequest: null })).toEqual(
      {
        host: 'remote',
        port: 6379,
        db: 1,
        username: 'user',
        password: 'pass',
        tls: {},
        maxRetriesPerRequest: null,
      },
    );
  });
});
