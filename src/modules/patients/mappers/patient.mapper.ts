/****
 * File: patient.mapper.ts
 * Module: patients
 * Purpose: Maps between entities, DTOs, and external representations.
 *
 ****/

import { Patient } from '../entities/patient.entity';
import { PatientResponseDto } from '../dto';

export class PatientMapper {
  static toResponse(entity: Patient): PatientResponseDto {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
    };
  }
}

