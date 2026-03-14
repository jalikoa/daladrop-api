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

  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;

  @IsInt()
  @IsOptional()
  response_status?: number;
}
