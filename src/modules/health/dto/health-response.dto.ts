import { Expose, Transform } from 'class-transformer';

export class HealthCheckResultDto {
  @Expose()
  status: 'ok' | 'error';

  @Expose()
  info?: Record<string, unknown>;

  @Expose()
  error?: Record<string, unknown>;

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  timestamp: Date;
}

export class SystemMetricsDto {
  @Expose()
  uptime: number;

  @Expose()
  memory_usage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };

  @Expose()
  cpu_usage: number;

  @Expose()
  version: string;
}
