import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';

@Injectable()
export class AuditRepository {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async create(data: CreateAuditLogDto): Promise<AuditLog> {
    const log = this.repo.create(data);
    return this.repo.save(log) as Promise<AuditLog>; // Cast to single entity
  }

  async findAll(page: number, limit: number, filters?: { userId?: number; action?: string }): Promise<{ data: AuditLog[]; total: number }> {
    const queryBuilder = this.repo.createQueryBuilder('log').orderBy('log.created_at', 'DESC');

    if (filters?.userId) {
      queryBuilder.andWhere('log.user_id = :userId', { userId: filters.userId });
    }

    if (filters?.action) {
      queryBuilder.andWhere('log.action LIKE :action', { action: `%${filters.action}%` });
    }

    const [data, total] = await queryBuilder.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, total };
  }
}