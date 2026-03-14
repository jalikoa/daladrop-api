import { Injectable } from '@nestjs/common';
import type { IUserRepository } from '../interfaces/user-repository.interface';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class UpdateUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.userRepo.update(id, dto);

    this.eventEmitter.emit('user.updated', {
      userId: user.id,
      timestamp: new Date(),
    });

    return user;
  }
}
