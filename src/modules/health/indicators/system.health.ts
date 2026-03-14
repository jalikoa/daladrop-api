import { Injectable } from '@nestjs/common';
import { IHealthIndicator, HealthIndicatorResult } from '../interfaces/health-check.interface';
import * as os from 'os';

@Injectable()
export class SystemHealthIndicator implements IHealthIndicator {
  name = 'system';

  async check(): Promise<HealthIndicatorResult> {
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();
    const usagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;

    if (usagePercent > 90) {
      return { status: 'down', message: `Memory usage critical: ${usagePercent.toFixed(2)}%` };
    }

    return { status: 'up', message: `Memory usage: ${usagePercent.toFixed(2)}%` };
  }
}
