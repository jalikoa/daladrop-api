import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAccountDto {
  @ApiProperty({ example: 'DALADROP_KES' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  chartCode!: string;

  @ApiProperty({ example: '4300' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @ApiProperty({ example: 'Promo Revenue' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] })
  @IsIn(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])
  accountType!: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

  @ApiPropertyOptional({ example: 'KES' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class EnsurePeriodDto {
  @ApiPropertyOptional({
    description: 'ISO timestamp to cover; defaults to now',
  })
  @IsOptional()
  @IsDateString()
  at?: string;
}

export class ClosePeriodDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class JournalLineInputDto {
  @ApiProperty({ example: '1000' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  accountCode!: string;

  @ApiProperty({ description: 'Whole KES shillings as string or number', example: '100' })
  @IsString()
  debitAmount!: string;

  @ApiProperty({ example: '0' })
  @IsString()
  creditAmount!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;
}

export class CreateJournalDraftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'KES' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Value date ISO; defaults to now' })
  @IsOptional()
  @IsDateString()
  valueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  externalRef?: string;

  @ApiProperty({ type: [JournalLineInputDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineInputDto)
  lines!: JournalLineInputDto[];
}

export class ReverseJournalDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  idempotencyKey!: string;
}

export class ListJournalsQueryDto {
  @ApiPropertyOptional({ enum: ['DRAFT', 'POSTED', 'VOIDED'] })
  @IsOptional()
  @IsEnum(['DRAFT', 'POSTED', 'VOIDED'] as const)
  status?: 'DRAFT' | 'POSTED' | 'VOIDED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class ListAccountsQueryDto {
  @ApiPropertyOptional({ example: 'DALADROP_KES' })
  @IsOptional()
  @IsString()
  chartCode?: string;
}

export class ReportPeriodQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  periodId?: string;

  @ApiPropertyOptional({ description: 'ISO as-of date for balance sheet' })
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountCode?: string;
}

export class ExportReportQueryDto extends ReportPeriodQueryDto {
  @ApiProperty({ enum: ['csv', 'xlsx', 'pdf'] })
  @IsIn(['csv', 'xlsx', 'pdf'])
  format!: 'csv' | 'xlsx' | 'pdf';
}

export class AccountViewDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  code!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  accountType!: string;
  @ApiProperty()
  normalBalance!: string;
  @ApiProperty()
  isSystem!: boolean;
  @ApiProperty()
  isActive!: boolean;
  @ApiProperty()
  currency!: string;
}

export class JournalEntryViewDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  entryNumber!: string;
  @ApiProperty()
  status!: string;
  @ApiPropertyOptional()
  description?: string | null;
  @ApiProperty()
  valueDate!: string;
  @ApiProperty()
  currency!: string;
  @ApiPropertyOptional()
  paymentId?: string | null;
  @ApiPropertyOptional()
  postedAt?: string | null;
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  lines!: ReadonlyArray<Record<string, unknown>>;
}
