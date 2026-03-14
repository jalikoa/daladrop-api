import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuditService } from '../audit.service';
import { AuditAction } from '../enums/audit-action.enum';

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLoggingInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const user = (request as any).user;

    if (request.url.includes('/health') || request.url.includes('/auth/login')) {
      return next.handle();
    }

    const now = Date.now();
    const action = this.mapAction(request.method, request.url);

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - now;
          this.auditService.log({
            user_id: (user as any)?.id,
            action,
            ip_address: request.ip,
            request_method: request.method,
            endpoint: request.url,
            user_agent: request.get('user-agent'),
            payload: request.body,
            response_status: response.statusCode,
          }).catch((err) => {
            this.logger.error('Failed to write audit log', err);
          });
          this.logger.debug(`Audit: ${action} by ${(user as any)?.email || 'anonymous'} (${responseTime}ms)`);
        },
        error: (error) => {
          this.auditService.log({
            user_id: (user as any)?.id,
            action: AuditAction.SYSTEM_ERROR,
            ip_address: request.ip,
            endpoint: request.url,
            payload: { error: (error as Error).message },
            response_status: response.statusCode || 500,
          }).catch(() => {});
        },
      }),
    );
  }

  private mapAction(method: string, url: string): string {
    if (url.includes('/payments')) return AuditAction.PAYMENT_INITIATED;
    if (url.includes('/users')) return AuditAction.USER_UPDATED;
    if (url.includes('/merchants')) return AuditAction.MERCHANT_CREATED;
    return `${method}.${url.split('/')[1]?.toUpperCase() || 'UNKNOWN'}`;
  }
}
