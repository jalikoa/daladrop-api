import { Injectable, Inject } from '@nestjs/common';
import type { IUserRepository } from '../interfaces/user-repository.interface';
import { CreateUserDto } from '../dto/create-user.dto';
import { User } from '../entities/user.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(dto: CreateUserDto): Promise<User> {
    const user = await this.userRepo.create(dto);

    // Emit domain event
    this.eventEmitter.emit('user.created', {
      userId: user.id,
      email: user.email,
      role: user.role,
      timestamp: new Date(),
    });

    return user;
  }
}
