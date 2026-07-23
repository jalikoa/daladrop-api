/****
 * File: patients.service.ts
 * Module: patients
 * Purpose: Application service facade. Orchestrates use-cases and enforces domain rules.
 *
 ****/

import { Injectable } from '@nestjs/common';
// import { CreatePatientUseCase } from './use-cases/create-patient.usecase';
// import { FindPatientUseCase } from './use-cases/find-patient.usecase';

@Injectable()
export class PatientsService {
  constructor(
    // private readonly createUseCase: CreatePatientUseCase,
    // private readonly findUseCase: FindPatientUseCase,
  ) {}

  async findAll(page: number = 1, limit: number = 10) {
    // return this.findUseCase.execute(page, limit);
    return { data: [], total: 0 };
  }
}

