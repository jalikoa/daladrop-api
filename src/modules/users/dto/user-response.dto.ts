import { Expose, Transform } from 'class-transformer';
import { UserRole, UserStatus } from '../enums/user-role.enum';

export class UserResponseDto {
  @Expose()
  id: number;

  @Expose()
  uuid: string;

  @Expose()
  email: string | null;

  @Expose()
  phone_number: string | null;

  @Expose()
  role: UserRole;

  @Expose()
  status: UserStatus;

  @Expose()
  is_active: boolean;

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  created_at: Date;

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  updated_at: Date;
}
