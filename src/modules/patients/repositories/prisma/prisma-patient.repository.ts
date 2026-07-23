/****
 * File: prisma-patient.repository.ts
 * Module: patients
 * Purpose: Prisma implementation of the patient repository.
 *
 ****/

import { IPatientRepository } from '../../interfaces/patient-repository.interface';
import { Patient } from '../../entities/patient.entity';
import { CreatePatientDto, UpdatePatientDto, PatientsQueryDto } from '../../dto';

export class PrismaPatientRepository implements IPatientRepository {
  // TODO: Inject PrismaService here
  
  async create(dto: CreatePatientDto): Promise<Patient> {
    throw new Error('Method not implemented.');
  }
  
  async findById(id: string): Promise<Patient | null> {
    throw new Error('Method not implemented.');
  }
        
  async findAll(query: PatientsQueryDto): Promise<{ data: Patient[]; total: number }> {
    throw new Error('Method not implemented.');
  }
  
  async update(id: string, dto: UpdatePatientDto): Promise<Patient> {
    throw new Error('Method not implemented.');
  }
  
  async softDelete(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  
  async exists(id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
}

