import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not } from 'typeorm';
import { MerchantProfile } from '../entities/merchant-profile.entity';
import { IMerchantRepository } from '../interfaces/merchant-repository.interface';
import { CreateMerchantDto } from '../dto/create-merchant.dto';
import { UpdateMerchantDto } from '../dto/update-merchant.dto';
import { MerchantStatus } from '../enums/merchant-status.enum';

@Injectable()
export class MerchantRepository implements IMerchantRepository {
  constructor(
    @InjectRepository(MerchantProfile)
    private readonly repo: Repository<MerchantProfile>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: number): Promise<MerchantProfile | null> {
    return this.repo.findOne({ where: { id }, relations: ['user'] });
  }

  async findByUserId(userId: number): Promise<MerchantProfile | null> {
    return this.repo.findOne({ where: { user_id: userId }, relations: ['user'] });
  }

  async findByPaybill(paybill: string): Promise<MerchantProfile | null> {
    return this.repo.findOne({ where: { paybill_number: paybill } });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    status?: MerchantStatus,
  ): Promise<{ data: MerchantProfile[]; total: number }> {
    const queryBuilder = this.repo.createQueryBuilder('merchant')
      .leftJoinAndSelect('merchant.user', 'user');
    
    if (status) {
      queryBuilder.where('merchant.status = :status', { status });
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('merchant.created_at', 'DESC')
      .getManyAndCount();

    return { data, total };
  }

  async create(userId: number, data: CreateMerchantDto): Promise<MerchantProfile> {
    const exists = await this.existsByUserId(userId);
    if (exists) {
      throw new ConflictException('Merchant profile already exists for this user');
    }

    const paybillExists = await this.repo.exists({ where: { paybill_number: data.paybill_number } });
    if (paybillExists) {
      throw new ConflictException('Paybill number already registered');
    }

    const merchant = this.repo.create({
      user_id: userId,
      ...data,
      metadata: data.metadata ? JSON.parse(data.metadata) : null,
      status: MerchantStatus.PENDING,
    });

    return this.repo.save(merchant);
  }

  async update(id: number, data: UpdateMerchantDto): Promise<MerchantProfile> {
    const merchant = await this.findById(id);
    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${id} not found`);
    }

    // Check paybill uniqueness if changed
    if ((data as any).paybill_number && (data as any).paybill_number !== merchant.paybill_number) {
      const exists = await this.repo.exists({ 
        where: { paybill_number: (data as any).paybill_number, id: Not(id) } 
      });
      if (exists) {
        throw new ConflictException('Paybill number already registered');
      }
    }

    await this.repo.update(id, {
      ...(data as any),
      metadata: (data as any).metadata ? JSON.parse((data as any).metadata) : undefined,
    });

    return this.findById(id) as Promise<MerchantProfile>;
  }

  async updateStatus(id: number, status: MerchantStatus): Promise<void> {
    await this.repo.update(id, { status });
  }

  async softDelete(id: number): Promise<void> {
    await this.repo.update(id, { status: MerchantStatus.DEACTIVATED });
  }

  async existsByUserId(userId: number): Promise<boolean> {
    return this.repo.exists({ where: { user_id: userId } });
  }

  async countActive(): Promise<number> {
    return this.repo.count({ 
      where: { 
        status: MerchantStatus.ACTIVE,
      } 
    });
  }
}
