/****
 * File: patients.events.ts
 * Module: patients
 * Purpose: Event payload classes emitted by the patients module.
 *
 ****/

export class PatientCreatedEvent {
  constructor(public readonly patientId: string, public readonly data: any) {}
}

export class PatientUpdatedEvent {
  constructor(public readonly patientId: string, public readonly data: any) {}
}

