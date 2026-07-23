/****
 * File: create-patient.dto.ts
 * Module: patients
 * Purpose: DTO for creating a new patient entity. Validated via class-validator.
 *
 ****/

import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePatientDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

