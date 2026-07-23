/****
 * File: patient.validator.ts
 * Module: patients
 * Purpose: Custom validation logic (e.g., signature verification, IP whitelisting).
 *
 ****/

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class PatientValidator {
  private readonly logger = new Logger(PatientValidator.name);
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('VALIDATION_SECRET_KEY') || '';
  }

  async verifySignature(payload: string, signature: string): Promise<boolean> {
    if (!signature) return false;
    
    try {
      const verifier = crypto.createVerify('SHA256');
      verifier.update(payload);
      verifier.end();
      return verifier.verify(this.secretKey, signature, 'base64');
    } catch (error) {
      this.logger.error('Signature verification failed', error);
      return false;
    }
  }
}

