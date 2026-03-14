import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateNfcTagDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  tag_uid?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsString()
  @IsOptional()
  metadata?: string;
}
