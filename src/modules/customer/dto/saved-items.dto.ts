import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

const SAVED_KINDS = [
  'restaurant',
  'merchant',
  'event',
  'market',
  'product',
] as const;

export class CreateSavedItemDto {
  @IsString()
  @IsIn(SAVED_KINDS)
  type: (typeof SAVED_KINDS)[number];

  @IsUUID()
  id: string;
}

export class ListSavedItemsQueryDto {
  @IsString()
  @IsIn(SAVED_KINDS)
  @MaxLength(32)
  type: (typeof SAVED_KINDS)[number];

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

export class ListFavouritesQueryDto {
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
