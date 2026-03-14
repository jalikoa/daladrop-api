import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
  IsPhoneNumber,
} from 'class-validator';
import { UserRole } from '../enums/user-role.enum';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsOptional()
  email?: string;

  @IsPhoneNumber('KE', { message: 'Invalid Kenyan phone number' })
  @IsOptional()
  phone_number?: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @IsOptional()
  password?: string;

  @IsEnum(UserRole)
  @IsOptional()
  @Transform(({ value }) => value?.toUpperCase())
  role?: UserRole;
}
