/****
 * File: patient-owner.guard.ts
 * Module: patients
 * Purpose: Guard that verifies the current user owns or has access to the patient.
 *
 ****/

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PatientOwnerGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // TODO: Implement actual ownership check against request.params.id
    if (!user) throw new ForbiddenException('User not authenticated');
    
    return true; 
  }
}

