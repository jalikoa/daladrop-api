import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SettlementBatchStatus, WalletOwnerType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateSettlementBatchDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  policyId!: string;

  @ApiPropertyOptional({
    description: 'Also accepted via Idempotency-Key header',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;

  @ApiPropertyOptional({
    description: 'Bypass the policy cutoff-time gate (admin override)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiPropertyOptional({ description: 'ISO date-time to record as scheduledFor' })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}

export class ProcessSettlementBatchDto {
  @ApiPropertyOptional({
    description: 'Also accepted via Idempotency-Key header',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class ListSettlementBatchesQueryDto {
  @ApiPropertyOptional({ enum: SettlementBatchStatus })
  @IsOptional()
  @IsEnum(SettlementBatchStatus)
  status?: SettlementBatchStatus;

  @ApiPropertyOptional({ enum: WalletOwnerType })
  @IsOptional()
  @IsEnum(WalletOwnerType)
  beneficiaryType?: WalletOwnerType;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
