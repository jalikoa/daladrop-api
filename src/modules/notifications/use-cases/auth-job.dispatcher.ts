import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AUTH_NOTIFICATION_QUEUE } from '../../identity/constants/auth.constants';
import type { AuthBackgroundJob } from '../domain/auth-job.types';

@Injectable()
export class AuthJobDispatcher {
  public constructor(
    @InjectQueue(AUTH_NOTIFICATION_QUEUE)
    private readonly queue: Queue<AuthBackgroundJob>,
  ) {}

  public async dispatch(job: AuthBackgroundJob): Promise<string> {
    const queued = await this.queue.add(job.kind, job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: { age: 3_600, count: 10_000 },
      removeOnFail: { age: 7 * 24 * 3_600, count: 50_000 },
    });
    if (!queued.id) throw new Error('Queue did not assign a job id');
    return String(queued.id);
  }
}
