import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  UniversalSearchService,
  type SearchScope,
} from '../use-cases/universal-search.service';

const SCOPES = [
  'all',
  'restaurants',
  'products',
  'events',
  'merchants',
  'markets',
  'liquor',
  'gas',
  'transport',
  'parcels',
] as const;

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(SCOPES)
  scope?: SearchScope;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ description: 'Alias for limit' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  sort?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @IsOptional()
  facets?: boolean | string;
}

export class AutocompleteQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

@ApiTags('Search')
@Controller({ path: 'search', version: '1' })
export class SearchController {
  public constructor(private readonly search: UniversalSearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Universal search across platform resources',
    description:
      'Searches restaurants, products, events, merchants, markets, liquor, gas, transport and parcels via the platform SearchService.',
  })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'scope', required: false, enum: SCOPES })
  public searchAll(@Query() query: SearchQueryDto) {
    return this.search.search({
      ...query,
      limit: query.limit ?? query.pageSize,
    });
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete suggestions for search prefixes' })
  public autocomplete(@Query() query: AutocompleteQueryDto) {
    return this.search.autocomplete(query);
  }
}
