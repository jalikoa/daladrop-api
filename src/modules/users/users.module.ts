import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { CreateUserUseCase } from './use-cases/create-user.usecase';
import { FindUserUseCase } from './use-cases/find-user.usecase';
import { UpdateUserUseCase } from './use-cases/update-user.usecase';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    EventEmitterModule.forRoot(),
  ],
  providers: [
    UserRepository,
    { provide: 'IUserRepository', useExisting: UserRepository },
    CreateUserUseCase,
    FindUserUseCase,
    UpdateUserUseCase,
    UsersService,
  ],
  controllers: [UsersController],
  exports: [UsersService, 'IUserRepository', CreateUserUseCase, FindUserUseCase],
})
export class UsersModule {}
