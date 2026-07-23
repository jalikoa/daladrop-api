/****
 * File: patients.processor.ts
 * Module: patients
 * Purpose: Background job processor (e.g., BullMQ) for this domain.
 *
 ****/

import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PATIENTS_QUEUE } from '../constants/patients.constants';

@Processor(PATIENTS_QUEUE.NAME)
export class PatientsProcessor {
  private readonly logger = new Logger(PatientsProcessor.name);

  @Process(PATIENTS_QUEUE.PROCESSORS.PROCESS)
  async processJob(job: Job<any>) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
    // TODO: Implement background processing logic
  }
}

