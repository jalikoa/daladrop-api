/****
 * File: patients.module.ts
 * Module: patients
 * Purpose: NestJS module definition. Wires controllers, services, repositories, and use-cases.
 *
 ****/

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// import { Patient } from './entities/patient.entity';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { PatientsRepositoryProvider } from './repositories/patients.repository';
// import { CreatePatientUseCase } from './use-cases/create-patient.usecase';

@Module({
  // imports: [TypeOrmModule.forFeature([Patient])],
  controllers: [PatientsController],
  providers: [
    PatientsService,
    PatientsRepositoryProvider,
    // CreatePatientUseCase,
  ],
  exports: [PatientsService, PATIENTS_REPOSITORY],
})
export class PatientsModule {}

