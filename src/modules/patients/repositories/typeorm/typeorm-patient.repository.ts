/****
 * File: typeorm-patient.repository.ts
 * Module: patients
 * Purpose: TypeORM implementation of the patient repository.
 *
 ****/

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { IPatientRepository } from '../../interfaces/patient-repository.interface';
import { Patient } from '../../entities/patient.entity';
import { CreatePatientDto, UpdatePatientDto, PatientsQueryDto } from '../../dto';

@Injectable()
export class TypeOrmPatientRepository implements IPatientRepository {
  constructor(
    @InjectRepository(Patient)
    private readonly repo: Repository<Patient>,
  ) {}

  async create(dto: CreatePatientDto): Promise<Patient> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async findById(id: string): Promise<Patient | null> {
    return this.repo.findOne({ where: { id, deletedAt: IsNull() } });
  }

  async findAll(query: PatientsQueryDto): Promise<{ data: Patient[]; total: number }> {
    const [data, total] = await this.repo.findAndCount({
      where: { deletedAt: IsNull() },
      skip: ((query.page || 1) - 1) * (query.limit || 10),
      take: query.limit || 10,
    });
    return { data, total };
  }

  async update(id: string, dto: UpdatePatientDto): Promise<Patient> {
    await this.repo.update(id, dto);
    return this.findById(id) as Promise<Patient>;
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  async exists(id: string): Promise<boolean> {
    return this.repo.exists({ where: { id, deletedAt: IsNull() } });
  }
}

