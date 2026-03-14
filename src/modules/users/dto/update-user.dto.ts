import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { UserStatus } from '../enums/user-role.enum';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @IsOptional()
  is_active?: boolean;
}
