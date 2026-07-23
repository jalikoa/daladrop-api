/****
 * File: patients-response.dto.ts
 * Module: patients
 * Purpose: DTO for patients API responses. Shapes the data returned to clients.
 *
 ****/

import { ApiProperty } from '@nestjs/swagger';

export class PatientResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  createdAt: Date;
}

