import { Injectable, Logger } from '@nestjs/common';
import { AuditRepository } from '../repositories/audit.repository';
import { AuditLogJobData } from '../interfaces/audit-log-job.interface';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';

@Injectable()
export class AuditBatchService {
  private readonly logger = new Logger(AuditBatchService.name);

  constructor(private readonly auditRepo: AuditRepository) {}

  /**
   * Write a batch of audit logs to the database in a single transaction.
   * This is more efficient than individual writes and reduces database load.
   */
  async writeBatch(logs: AuditLogJobData[]): Promise<void> {
    if (logs.length === 0) {
      return;
    }

    try {
      const auditLogs: CreateAuditLogDto[] = logs.map((log) => ({
        user_id: log.user_id,
        action: log.action,
        ip_address: log.ip_address,
        request_method: log.request_method,
        endpoint: log.endpoint,
        user_agent: log.user_agent,
        payload: log.payload,
        response_status: log.response_status,
      }));

      await this.auditRepo.createBatch(auditLogs);
      
      this.logger.debug(`Successfully wrote ${logs.length} audit logs to database`);
    } catch (error) {
      this.logger.error(`Failed to write batch of ${logs.length} audit logs:`, error);
      throw error;
    }
  }
}
