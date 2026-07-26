import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  /** UI alias for lastName (`02-users.md`). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  surname?: string;

  @IsOptional()
  @IsString()
  @MinLength(9)
  @MaxLength(20)
  phone?: string;
}

export class UpdatePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  newPassword: string;
}

export class AdminStatusDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminListUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  offset?: string;
}

export class PublicUploadMetaDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  folder?: string;
}
