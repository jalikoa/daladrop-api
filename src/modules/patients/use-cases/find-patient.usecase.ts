/****
 * File: find-patient.usecase.ts
 * Module: patients
 * Purpose: Use-case for retrieving patient records.
 *
 ****/

import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PATIENTS_REPOSITORY } from '../constants/patients.constants';
import type { IPatientRepository } from '../interfaces/patient-repository.interface';

@Injectable()
export class FindPatientUseCase {
  constructor(
    @Inject(PATIENTS_REPOSITORY) 
    private readonly repository: IPatientRepository
  ) {}

  async byId(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }
    return entity;
  }
}

