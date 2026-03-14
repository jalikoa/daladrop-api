import { Injectable } from '@nestjs/common';
import { AuditRepository } from './repositories/audit.repository';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(private readonly auditRepo: AuditRepository) {}

  async log(data: CreateAuditLogDto): Promise<AuditLog> {
    return this.auditRepo.create(data);
  }

  async getLogs(page: number, limit: number, filters?: { userId?: number; action?: string }): Promise<{ data: AuditLog[]; total: number }> {
    return this.auditRepo.findAll(page, limit, filters);
  }
}
