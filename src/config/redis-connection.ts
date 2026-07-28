import type { ConfigService } from '@nestjs/config';
import {
  parseRedisUrl,
  type ParsedRedisUrl,
} from '../infrastructure/redis/redis-connection.factory';

export interface RedisRuntimeConnection {
  readonly host: string;
  readonly port: number;
  readonly password?: string;
  readonly username?: string;
  readonly db: number;
  readonly tls?: Record<string, never>;
}

/**
 * Resolve Redis connection options for ioredis / Bull / BullMQ.
 * Prefers REDIS_URL (incl. rediss:// TLS) over discrete host/port keys.
 */
export function resolveRedisRuntimeConnection(input: {
  readonly url?: string;
  readonly host?: string;
  readonly port?: number;
  readonly password?: string;
  readonly username?: string;
  readonly tls?: boolean;
  readonly db?: number;
}): RedisRuntimeConnection {
  const url = input.url?.trim();
  let parsed: ParsedRedisUrl | undefined;
  if (url) {
    parsed = parseRedisUrl(url);
  }

  const host = parsed?.host ?? input.host ?? '127.0.0.1';
  const port = parsed?.port ?? input.port ?? 6379;
  const password = parsed?.password ?? input.password;
  const username = parsed?.username ?? input.username;
  const db = input.db ?? parsed?.db ?? 0;
  const useTls = parsed?.tls ?? input.tls ?? false;

  return {
    host,
    port,
    db,
    ...(password ? { password } : {}),
    ...(username ? { username } : {}),
    ...(useTls ? { tls: {} } : {}),
  };
}

/** Nest ConfigService → Bull / BullMQ connection object. */
export function redisConnectionFromConfig(
  config: ConfigService,
  extras: { readonly maxRetriesPerRequest?: null } = {},
): RedisRuntimeConnection & { readonly maxRetriesPerRequest?: null } {
  const connection = resolveRedisRuntimeConnection({
    url: config.get<string>('redis.url') ?? process.env.REDIS_URL,
    host: config.get<string>('redis.host'),
    port: config.get<number>('redis.port'),
    password: config.get<string>('redis.password') || undefined,
    username: config.get<string>('redis.username') || undefined,
    tls: config.get<boolean>('redis.tls'),
    db: config.get<number>('redis.db'),
  });
  return {
    ...connection,
    ...(extras.maxRetriesPerRequest === null
      ? { maxRetriesPerRequest: null }
      : {}),
  };
}
