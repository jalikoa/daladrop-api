import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IHealthIndicator, HealthIndicatorResult } from '../interfaces/health-check.interface';

@Injectable()
export class DatabaseHealthIndicator implements IHealthIndicator {
  name = 'database';

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async check(): Promise<HealthIndicatorResult> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      const latency = Date.now() - start;
      return { status: 'up', latency };
    } catch (error: any) {
      return { status: 'down', message: error?.message || String(error) };
    }
  }
}
