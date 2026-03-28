import { Injectable, Logger } from '@nestjs/common';
import { AuditQueue } from './queues/audit.queue';
import { AuditLogJobData } from './interfaces/audit-log-job.interface';
import { AuditRepository } from './repositories/audit.repository';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly auditQueue: AuditQueue,
    private readonly auditRepo: AuditRepository,
  ) {}

  /**
   * Log an audit event asynchronously via the queue.
   * This is non-blocking and batches writes every 3 seconds.
   */
  async log(data: Omit<AuditLogJobData, 'timestamp'>): Promise<void> {
    try {
      await this.auditQueue.add(data);
      this.logger.debug(`Audit log queued: ${data.action}`);
    } catch (error) {
      // Log error but don't throw - audit logging should not block requests
      this.logger.error(`Failed to queue audit log: ${data.action}`, error);
    }
  }

  /**
   * Get audit logs with pagination and filters.
   */
  async getLogs(page: number, limit: number, filters?: { userId?: number; action?: string }): Promise<{ data: AuditLog[]; total: number }> {
    return this.auditRepo.findAll(page, limit, filters);
  }

  /**
   * Get the current buffer size (for monitoring)
   */
  getBufferSize(): number {
    return this.auditQueue.getBufferSize();
  }
}
