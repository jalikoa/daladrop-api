/****
 * File: create-patient.usecase.ts
 * Module: patients
 * Purpose: Use-case for creating a patient. Contains business logic.
 *
 ****/

import { Injectable, Inject } from '@nestjs/common';
import { PATIENTS_REPOSITORY } from '../constants/patients.constants';
import type { IPatientRepository } from '../interfaces/patient-repository.interface';
import { CreatePatientDto } from '../dto';

@Injectable()
export class CreatePatientUseCase {
  constructor(
    @Inject(PATIENTS_REPOSITORY) 
    private readonly repository: IPatientRepository
  ) {}

  async execute(dto: CreatePatientDto) {
    // TODO: Add business validation rules here before calling repository
    return this.repository.create(dto);
  }
}

