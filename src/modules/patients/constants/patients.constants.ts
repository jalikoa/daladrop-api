/****
 * File: patients.constants.ts
 * Module: patients
 * Purpose: Domain-wide constants: provider tokens, queue names, event names.
 *
 ****/

/**** Provider token for dependency injection (ORM-agnostic) ****/
export const PATIENTS_REPOSITORY = 'PATIENTS_REPOSITORY';
export const PATIENTS_SERVICE = 'PATIENTS_SERVICE';

/**** Queue names for async processing ****/
export const PATIENTS_QUEUE = {
  NAME: 'patients-queue',
  PROCESSORS: {
    PROCESS: 'process-patients',
  }
};

/**** Domain events emitted by this module ****/
export const PATIENTS_EVENTS = {
  CREATED: 'patients.created',
  UPDATED: 'patients.updated',
  DELETED: 'patients.deleted',
} as const;

