/****
 * File: patient.vo.ts
 * Module: patients
 * Purpose: Value objects for patients domain invariants (immutable, self-validating).
 *
 ****/

export class PatientValueObject {
  constructor(public readonly value: string) {
    // TODO: Add validation logic in constructor
    if (!value) throw new Error('Value is required');
  }

  // TODO: Add domain-specific methods
  equals(other: PatientValueObject): boolean {
    return this.value === other.value;
  }
}

