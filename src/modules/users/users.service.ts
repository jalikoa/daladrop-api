import { Injectable, Inject } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { CreateUserUseCase } from './use-cases/create-user.usecase';
import { FindUserUseCase } from './use-cases/find-user.usecase';
import { UpdateUserUseCase } from './use-cases/update-user.usecase';
import type { IUserRepository } from './interfaces/user-repository.interface';
import { UserMapper } from './mappers/user.mapper';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly findUserUseCase: FindUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.createUserUseCase.execute(dto);
    return UserMapper.toDTO(user);
  }

  async findOne(id: number): Promise<UserResponseDto> {
    const user = await this.findUserUseCase.byId(id);
    return UserMapper.toDTO(user);
  }

  async findByUuid(uuid: string): Promise<UserResponseDto> {
    const user = await this.findUserUseCase.byUuid(uuid);
    return UserMapper.toDTO(user);
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.updateUserUseCase.execute(id, dto);
    return UserMapper.toDTO(user);
  }

  async remove(id: number): Promise<void> {
    await this.userRepo.softDelete(id);
  }

  async findAll(page: number, limit: number): Promise<{ data: UserResponseDto[]; total: number }> {
    const result = await (this.userRepo as any).findAll(page, limit);
    return {
      data: UserMapper.toDTOArray(result.data),
      total: result.total,
    };
  }
}
