import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { AUDIT_CONSTANTS } from '../constants/audit.constants';
import { AuditLogJobData, AuditBatchJobData } from '../interfaces/audit-log-job.interface';

@Injectable()
export class AuditQueue implements OnModuleInit, OnModuleDestroy {
  private flushTimer: NodeJS.Timeout | null = null;
  private buffer: AuditLogJobData[] = [];
  private isFlushing = false;

  constructor(
    @InjectQueue(AUDIT_CONSTANTS.QUEUE.NAME) private readonly auditQueue: Queue,
  ) {}

  async onModuleInit() {
    // Start the periodic flush timer (every 3 seconds)
    this.flushTimer = setInterval(
      () => this.flushBuffer(),
      AUDIT_CONSTANTS.BATCH.FLUSH_INTERVAL_MS,
    );
  }

  async onModuleDestroy() {
    // Flush remaining logs on shutdown
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushBuffer();
  }

  /**
   * Add an audit log to the buffer.
   * When buffer reaches max size, it's immediately flushed to the queue.
   */
  async add(log: Omit<AuditLogJobData, 'timestamp'>): Promise<void> {
    this.buffer.push({
      ...log,
      timestamp: Date.now(),
    });

    // Flush immediately if buffer is full
    if (this.buffer.length >= AUDIT_CONSTANTS.BATCH.MAX_SIZE) {
      await this.flushBuffer();
    }
  }

  /**
   * Flush the buffer to the queue as a batch job.
   */
  private async flushBuffer(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) {
      return;
    }

    this.isFlushing = true;

    try {
      const logsToFlush = [...this.buffer];
      this.buffer = [];

      await this.auditQueue.add('batch.write', {
        logs: logsToFlush,
        batchSize: logsToFlush.length,
      }, {
        attempts: AUDIT_CONSTANTS.RETRY.MAX_ATTEMPTS,
        backoff: {
          type: 'fixed',
          delay: AUDIT_CONSTANTS.RETRY.BACKOFF_DELAY_MS,
        },
      });
    } catch (error) {
      // If flush fails, put logs back at the front of the buffer
      this.buffer = [...this.buffer, ...this.buffer];
      throw error;
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Get current buffer size (for monitoring/debugging)
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
}
