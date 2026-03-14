import { IsString, IsOptional, IsObject, IsInt } from 'class-validator';

export class CreateAuditLogDto {
  @IsInt()
  @IsOptional()
  user_id?: number;

  @IsString()
  action: string;

  @IsString()
  @IsOptional()
  ip_address?: string;

  @IsString()
  @IsOptional()
  request_method?: string;

  @IsString()
  @IsOptional()
  endpoint?: string;

  @IsString() // Added to support user agent logging
  @IsOptional()
  user_agent?: string;

  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;

  @IsInt()
  @IsOptional()
  response_status?: number;
}