import { User } from '../entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserRole, UserStatus } from '../enums/user-role.enum';

export interface IUserRepository {
  findById(id: number): Promise<User | null>;
  findByUuid(uuid: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  findAll(page: number, limit: number, role?: UserRole): Promise<{ data: User[]; total: number }>;
  create(data: CreateUserDto): Promise<User>;
  update(id: number, data: UpdateUserDto): Promise<User>;
  softDelete(id: number): Promise<void>;
  updateStatus(id: number, status: UserStatus): Promise<void>;
  existsByEmail(email: string): Promise<boolean>;
  existsByPhone(phone: string): Promise<boolean>;
}
