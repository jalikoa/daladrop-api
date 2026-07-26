import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListNotificationsQueryDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class RegisterPushTokenDto {
  @IsUUID()
  userId: string;

  @IsString()
  @MaxLength(512)
  token: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  platform: string;
}

export class UnregisterPushTokenDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  token?: string;
}

export class BroadcastNotificationDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @Type(() => String)
  userIds?: string[];

  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  type?: string;
}

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  categories?: Record<string, unknown> | null;
}
