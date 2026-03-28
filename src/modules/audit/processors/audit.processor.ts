import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { AuditBatchService } from '../services/audit-batch.service';
import { AUDIT_CONSTANTS } from '../constants/audit.constants';
import { AuditBatchJobData } from '../interfaces/audit-log-job.interface';

@Processor(AUDIT_CONSTANTS.QUEUE.NAME)
export class AuditProcessor {
  constructor(private readonly auditBatchService: AuditBatchService) {}

  @Process('batch.write')
  async processBatchWrite(job: Job<AuditBatchJobData>) {
    const { logs, batchSize } = job.data;
    
    try {
      await this.auditBatchService.writeBatch(logs);
      return { success: true, processed: batchSize };
    } catch (error) {
      // Log error but don't throw - let Bull handle retries
      console.error(`Failed to process audit batch job ${job.id}:`, error);
      throw error;
    }
  }
}
