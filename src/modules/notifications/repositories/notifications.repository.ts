import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { NotificationStatus } from '../enums/notification-channel.enum';

@Injectable()
export class NotificationsRepository {
  constructor(
    @InjectRepository(Notification)
    private readonly repository: Repository<Notification>,
  ) {}

  async findAll(page: number = 1, limit: number = 20): Promise<{ data: Notification[]; total: number }> {
    const [data, total] = await this.repository.findAndCount({
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async findById(id: number): Promise<Notification | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByUserId(userId: number, page: number = 1, limit: number = 20): Promise<{ data: Notification[]; total: number }> {
    const [data, total] = await this.repository.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async findByStatus(status: NotificationStatus, page: number = 1, limit: number = 20): Promise<{ data: Notification[]; total: number }> {
    const [data, total] = await this.repository.findAndCount({
      where: { status },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }
}
