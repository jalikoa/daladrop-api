import { User } from '../entities/user.entity';
import { UserResponseDto } from '../dto/user-response.dto';
import { plainToInstance } from 'class-transformer';

export class UserMapper {
  static toDTO(user: User): UserResponseDto {
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  static toDTOArray(users: User[]): UserResponseDto[] {
    return users.map((user) => this.toDTO(user));
  }
}
