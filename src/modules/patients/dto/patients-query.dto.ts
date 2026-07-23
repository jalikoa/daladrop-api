/****
 * File: patients-query.dto.ts
 * Module: patients
 * Purpose: DTO for query parameters (pagination, filters, sorting).
 *
 ****/

import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PatientsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

