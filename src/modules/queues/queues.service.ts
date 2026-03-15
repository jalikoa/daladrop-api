import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, Job, JobStatus } from 'bull';
import { LEDGER_CONSTANTS } from '../ledger/constants/ledger.constants';
import { PDF_QUEUES } from '../pdf/constants/pdf.constants';

export const QUEUE_NAMES = {
  LEDGER: LEDGER_CONSTANTS.QUEUE.NAME,       // 'ledger-queue'
  PDF: PDF_QUEUES.MERCHANT_CARD,             // 'pdf-queue'
  PDF_REPORT: PDF_QUEUES.REPORT,             // 'pdf-report-queue'
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface JobSummary {
  id: string | number;
  name: string;
  status: JobStatus;
  data: unknown;
  failedReason?: string;
  attemptsMade: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}

@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.LEDGER) private readonly ledgerQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PDF) private readonly pdfQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PDF_REPORT) private readonly pdfReportQueue: Queue,
  ) {}

  private getQueue(name: string): Queue {
    const map: Record<string, Queue> = {
      [QUEUE_NAMES.LEDGER]: this.ledgerQueue,
      [QUEUE_NAMES.PDF]: this.pdfQueue,
      [QUEUE_NAMES.PDF_REPORT]: this.pdfReportQueue,
    };
    const queue = map[name];
    if (!queue) {
      throw new NotFoundException(
        `Queue "${name}" not found. Available: ${Object.keys(map).join(', ')}`,
      );
    }
    return queue;
  }

  /**
   * Returns a count summary for all registered queues.
   */
  async getAllStatuses(): Promise<QueueStatus[]> {
    const queues = [
      { name: QUEUE_NAMES.LEDGER, queue: this.ledgerQueue },
      { name: QUEUE_NAMES.PDF, queue: this.pdfQueue },
      { name: QUEUE_NAMES.PDF_REPORT, queue: this.pdfReportQueue },
    ];

    return Promise.all(
      queues.map(async ({ name, queue }) => {
        const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
          queue.isPaused(),
        ]);
        return { name, waiting, active, completed, failed, delayed, paused: isPaused };
      }),
    );
  }

  /**
   * Returns job counts + pause state for a single queue.
   */
  async getQueueStatus(queueName: string): Promise<QueueStatus> {
    const queue = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);
    return { name: queueName, waiting, active, completed, failed, delayed, paused: isPaused };
  }

  /**
   * Lists jobs in a given state for a queue. Defaults to 'failed'.
   */
  async getJobs(
    queueName: string,
    state: JobStatus = 'failed',
    start = 0,
    end = 20,
  ): Promise<JobSummary[]> {
    const queue = this.getQueue(queueName);
    const jobs: Job[] = await queue.getJobs([state], start, end);
    return jobs.map((job) => this.toSummary(job, state));
  }

  /**
   * Fetches a single job by id from a queue.
   */
  async getJob(queueName: string, jobId: string): Promise<JobSummary> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found in queue "${queueName}"`);
    }
    const state = await job.getState();
    return this.toSummary(job, state as JobStatus);
  }

  /**
   * Retries a failed job by id.
   */
  async retryJob(queueName: string, jobId: string): Promise<{ success: boolean; jobId: string }> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found in queue "${queueName}"`);
    }
    await job.retry();
    this.logger.log(`Retried job ${jobId} in queue "${queueName}"`);
    return { success: true, jobId };
  }

  /**
   * Removes a job permanently (any state).
   */
  async removeJob(queueName: string, jobId: string): Promise<{ success: boolean }> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found in queue "${queueName}"`);
    }
    await job.remove();
    this.logger.log(`Removed job ${jobId} from queue "${queueName}"`);
    return { success: true };
  }

  /**
   * Clears all jobs in a given state from a queue.
   */
  async cleanQueue(
    queueName: string,
    state: 'completed' | 'failed' = 'completed',
    gracePeriodMs = 0,
  ): Promise<{ removed: number }> {
    const queue = this.getQueue(queueName);
    const removed = await queue.clean(gracePeriodMs, state);
    this.logger.log(`Cleaned ${removed.length} "${state}" jobs from queue "${queueName}"`);
    return { removed: removed.length };
  }

  /**
   * Pauses job processing for a queue (jobs stay queued, workers stop picking them up).
   */
  async pauseQueue(queueName: string): Promise<{ paused: true }> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    this.logger.warn(`Queue "${queueName}" paused`);
    return { paused: true };
  }

  /**
   * Resumes a previously paused queue.
   */
  async resumeQueue(queueName: string): Promise<{ resumed: true }> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    this.logger.log(`Queue "${queueName}" resumed`);
    return { resumed: true };
  }

  private toSummary(job: Job, status: JobStatus): JobSummary {
    return {
      id: job.id,
      name: job.name,
      status,
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }
}