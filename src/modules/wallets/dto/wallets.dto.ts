import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EscrowStatus, WalletOwnerType } from '@prisma/client';
import { Type } from 'class-transformer';

export class WalletAmountDto {
  @ApiProperty({
    description: 'Whole KES shillings as numeric string',
    example: '500',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  amount!: string;

  @ApiPropertyOptional({ example: 'manual-credit' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  reference?: string;

  @ApiPropertyOptional({ example: 'Ops adjustment' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Also accepted via Idempotency-Key header',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  journalEntryId?: string;
}

export class WalletAdjustDto extends WalletAmountDto {
  @ApiProperty({
    description: 'Required reason for admin adjustment',
    example: 'Goodwill credit',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class WalletTransferDto {
  @ApiProperty()
  @IsUUID()
  fromWalletId!: string;

  @ApiProperty()
  @IsUUID()
  toWalletId!: string;

  @ApiProperty({ example: '100' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  amount!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class ListWalletsQueryDto {
  @ApiPropertyOptional({ enum: WalletOwnerType })
  @IsOptional()
  @IsEnum(WalletOwnerType)
  ownerType?: WalletOwnerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;

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

export class ListWalletTxnsQueryDto {
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

export class ExportWalletStatementQueryDto {
  @ApiProperty({ enum: ['csv', 'xlsx'] })
  @IsIn(['csv', 'xlsx'])
  format!: 'csv' | 'xlsx';
}

export class ListEscrowQueryDto {
  @ApiPropertyOptional({ enum: EscrowStatus })
  @IsOptional()
  @IsEnum(EscrowStatus)
  status?: EscrowStatus;

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

export class EscrowActionDto {
  @ApiPropertyOptional({
    description: 'Also accepted via Idempotency-Key header',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
