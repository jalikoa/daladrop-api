/****
 * File: patient-repository.interface.ts
 * Module: patients
 * Purpose: Repository contract. Both Prisma and TypeORM implementations must satisfy this.
 *
 ****/

import { CreatePatientDto, UpdatePatientDto, PatientsQueryDto } from '../dto';
import { Patient } from '../entities/patient.entity';

export interface IPatientRepository {
  create(dto: CreatePatientDto): Promise<Patient>;
  findById(id: string): Promise<Patient | null>;
  findAll(query: PatientsQueryDto): Promise<{ data: Patient[]; total: number }>;
  update(id: string, dto: UpdatePatientDto): Promise<Patient>;
  softDelete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

