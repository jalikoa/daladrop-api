import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { IUserRepository } from '../interfaces/user-repository.interface';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserRole, UserStatus } from '../enums/user-role.enum';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(User, 'identity')
    private readonly repo: Repository<User>,
    @InjectDataSource('identity') private readonly dataSource: DataSource,
  ) {}

  async findById(id: number): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByUuid(uuid: string): Promise<User | null> {
    return this.repo.findOne({ where: { uuid } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.repo.findOne({ where: { phone_number: phone } });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    role?: UserRole,
  ): Promise<{ data: User[]; total: number }> {
    const queryBuilder = this.repo.createQueryBuilder('user');
    if (role) {
      queryBuilder.where('user.role = :role', { role });
    }
    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('user.created_at', 'DESC')
      .getManyAndCount();
    return { data, total };
  }

  async create(data: CreateUserDto): Promise<User> {
    const existsEmail = data.email && (await this.existsByEmail(data.email));
    const existsPhone = data.phone_number && (await this.existsByPhone(data.phone_number));

    if (existsEmail) {
      throw new ConflictException('Email already registered');
    }
    if (existsPhone) {
      throw new ConflictException('Phone number already registered');
    }

    const passwordHash = data.password
      ? await bcrypt.hash(data.password, 10)
      : null;

    const user = this.repo.create({
      ...data,
      password_hash: passwordHash,
      role: data.role ?? UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      is_active: true,
    });

    return this.repo.save(user);
  }

  async update(id: number, data: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if ((data as any).password) {
      (data as any).password_hash = await bcrypt.hash((data as any).password, 10);
      delete (data as any).password;
    }

    await this.repo.update(id, data as any);
    return this.findById(id) as Promise<User>;
  }

  async softDelete(id: number): Promise<void> {
    await this.repo.update(id, { status: UserStatus.DELETED, is_active: false });
  }

  async updateStatus(id: number, status: UserStatus): Promise<void> {
    await this.repo.update(id, { status, is_active: status === UserStatus.ACTIVE });
  }

  async existsByEmail(email: string): Promise<boolean> {
    return this.repo.exists({ where: { email } });
  }

  async existsByPhone(phone: string): Promise<boolean> {
    return this.repo.exists({ where: { phone_number: phone } });
  }
}
