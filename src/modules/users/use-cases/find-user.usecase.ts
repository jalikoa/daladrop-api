import { Injectable, NotFoundException } from '@nestjs/common';
import type { IUserRepository } from '../interfaces/user-repository.interface';
import { User } from '../entities/user.entity';

@Injectable()
export class FindUserUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async byId(id: number): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async byUuid(uuid: string): Promise<User> {
    const user = await this.userRepo.findByUuid(uuid);
    if (!user) {
      throw new NotFoundException(`User with UUID ${uuid} not found`);
    }
    return user;
  }

  async byEmail(email: string): Promise<User> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
    return user;
  }
}
