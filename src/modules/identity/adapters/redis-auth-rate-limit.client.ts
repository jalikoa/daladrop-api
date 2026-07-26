import { Injectable } from '@nestjs/common';
import { RedisClientService } from '../../../infrastructure/redis/redis-client.service';
import type {
  RateLimitState,
  RedisRateLimitClient,
} from '../../../platform/security/http/rate-limit.service';

const SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

@Injectable()
export class RedisAuthRateLimitClient implements RedisRateLimitClient {
  public constructor(private readonly redis: RedisClientService) {}

  public async incrementWithExpiry(
    key: string,
    windowMs: number,
  ): Promise<RateLimitState> {
    const result = await this.redis.eval(
      SCRIPT,
      1,
      `rate:${key}`,
      String(windowMs),
    );
    if (
      !Array.isArray(result) ||
      result.length !== 2 ||
      !Number.isFinite(Number(result[0])) ||
      !Number.isFinite(Number(result[1]))
    ) {
      throw new Error('Invalid Redis rate-limit response');
    }
    return {
      count: Number(result[0]),
      resetAt: Date.now() + Math.max(0, Number(result[1])),
    };
  }
}
