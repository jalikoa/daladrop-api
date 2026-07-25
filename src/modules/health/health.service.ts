import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { SystemHealthIndicator } from './indicators/system.health';
import type { HealthIndicatorResult } from './interfaces/health-check.interface';

@Injectable()
export class HealthService {
  public constructor(
    private readonly dbHealth: DatabaseHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly systemHealth: SystemHealthIndicator,
    private readonly configService: ConfigService,
  ) {}

  public async checkAll(): Promise<Record<string, HealthIndicatorResult>> {
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

  public async checkReady(): Promise<boolean> {
    const [db, redis] = await Promise.all([
      this.dbHealth.check(),
      this.redisHealth.check(),
    ]);
    return db.status === 'up' && redis.status === 'up';
  }

  public getMetrics(): {
    uptime: number;
    memory_usage: NodeJS.MemoryUsage;
    cpu_usage: number;
    version: string;
  } {
    const usage = process.memoryUsage();
    return {
      uptime: process.uptime(),
      memory_usage: usage,
      cpu_usage: 0,
      version:
        this.configService.get<string>('app.version') ||
        process.env.npm_package_version ||
        '1.0.0',
    };
  }
}
