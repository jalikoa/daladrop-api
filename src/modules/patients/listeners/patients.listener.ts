/****
 * File: patients.listener.ts
 * Module: patients
 * Purpose: Event listener. Reacts to domain events (internal or cross-module).
 *
 ****/

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PatientCreatedEvent } from '../events';

@Injectable()
export class PatientsListener {
  private readonly logger = new Logger(PatientsListener.name);

  @OnEvent('patients.created')
  handlePatientCreated(event: PatientCreatedEvent) {
    this.logger.log(`Handling patients.created event for ID: ${event.patientId}`);
    // TODO: Trigger side effects (e.g., notifications, audit logs)
  }
}

