import { Injectable } from '@nestjs/common';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { SystemHealthIndicator } from './indicators/system.health';
import { HealthIndicatorResult } from './interfaces/health-check.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HealthService {
  constructor(
    private readonly dbHealth: DatabaseHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly systemHealth: SystemHealthIndicator,
    private readonly configService: ConfigService,
  ) {}

  async checkAll(): Promise<Record<string, HealthIndicatorResult>> {
    const [db, redis, system] = await Promise.all([
      this.dbHealth.check(),
      this.redisHealth.check(),
      this.systemHealth.check(),
    ]);

    return {
      [this.dbHealth.name]: db,
      [this.redisHealth.name]: redis,
      [this.systemHealth.name]: system,
    };
  }

  async checkReady(): Promise<boolean> {
    const db = await this.dbHealth.check();
    const redis = await this.redisHealth.check();
    return db.status === 'up' && redis.status === 'up';
  }

  getMetrics() {
    const usage = process.memoryUsage();
    return {
      uptime: process.uptime(),
      memory_usage: {
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external,
      },
      cpu_usage: 0,
      version: this.configService.get('npm_package_version') || '1.0.0',
    };
  }
}
