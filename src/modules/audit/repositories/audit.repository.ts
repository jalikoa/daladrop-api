import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';

@Injectable()
export class AuditRepository {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(data: CreateAuditLogDto): Promise<AuditLog> {
    const log = this.repo.create(data);
    return this.repo.save(log) as Promise<AuditLog>; // Cast to single entity
  }

  /**
   * Create multiple audit logs in a single transaction.
   * This is more efficient than individual inserts for batch operations.
   */
  async createBatch(data: CreateAuditLogDto[]): Promise<AuditLog[]> {
    if (data.length === 0) {
      return [];
    }

    const logs = data.map((item) => this.repo.create(item));
    return this.repo.save(logs) as Promise<AuditLog[]>;
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