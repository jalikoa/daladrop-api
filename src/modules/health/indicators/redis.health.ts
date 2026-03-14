import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { IHealthIndicator, HealthIndicatorResult } from '../interfaces/health-check.interface';

@Injectable()
export class RedisHealthIndicator implements IHealthIndicator {
  name = 'redis';

  constructor(@InjectQueue('payment-events') private readonly queue: Queue) {}

  async check(): Promise<HealthIndicatorResult> {
    const start = Date.now();
    try {
      const client: any = await (this.queue as any).client;
      if (!client) throw new Error('Redis client not available');
      if (typeof client.ping === 'function') await client.ping();
      const latency = Date.now() - start;
      return { status: 'up', latency };
    } catch (error: any) {
      return { status: 'down', message: error?.message || String(error) };
    }
  }
}
