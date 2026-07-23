/****
 * File: update-patient.dto.ts
 * Module: patients
 * Purpose: DTO for updating an existing patient entity. All fields optional.
 *
 ****/

import { PartialType } from '@nestjs/swagger';
import { CreatePatientDto } from './create-patient.dto';

export class UpdatePatientDto extends PartialType(CreatePatientDto) {}

