/****
 * File: patients.interceptor.ts
 * Module: patients
 * Purpose: Custom interceptor for logging, transformation, or metrics.
 *
 ****/

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class PatientsLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - now;
        console.log(`[${PASCAL.toUpperCase()}] ${request.method} ${request.url} - ${response.statusCode} - ${responseTime}ms`);
      }),
    );
  }
}

