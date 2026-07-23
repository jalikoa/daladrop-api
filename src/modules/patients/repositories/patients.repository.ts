/****
 * File: patients.repository.ts
 * Module: patients
 * Purpose: Factory provider. Selects Prisma or TypeORM implementation based on ORM_TYPE env.
 *
 ****/

import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PATIENTS_REPOSITORY } from '../constants/patients.constants';
import { PrismaPatientRepository } from './prisma/prisma-patient.repository';
import { TypeOrmPatientRepository } from './typeorm/typeorm-patient.repository';

export const PatientRepositoryProvider: Provider = {
  provide: PATIENTS_REPOSITORY,
  useFactory: (config: ConfigService) => {
    const orm = config.get<string>('ORM_TYPE', 'prisma');

    switch (orm) {
      case 'prisma':
        return new PrismaPatientRepository();
      case 'typeorm':
        return new TypeOrmPatientRepository();
      default:
        throw new Error(`Unsupported ORM: ${orm}`);
    }
  },
  inject: [ConfigService],
};

