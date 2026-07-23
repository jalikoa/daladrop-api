/****
 * File: patient.adapter.ts
 * Module: patients
 * Purpose: External service adapter (e.g., Daraja, AWS, Stripe). Implements a strict interface.
 *
 ****/

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface IPatientAdapter {
  // Define adapter contract methods here
  connect(): Promise<void>;
}

@Injectable()
export class PatientAdapter implements IPatientAdapter {
  private readonly logger = new Logger(PatientAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async connect(): Promise<void> {
    this.logger.log('Connecting to external service...');
    // TODO: Implement external API connection logic
  }
}

