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
import { AuditActions } from '../enums/audit-actions';

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLoggingInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const user = (request as any).user;

    // Skip health checks and login endpoints to avoid noise
    if (request.url.includes('/health') || request.url.includes('/auth/login')) {
      return next.handle();
    }

    const now = Date.now();
    const action = this.mapAction(request.method, request.url);

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - now;

          // Queue the audit log asynchronously (non-blocking)
          this.auditService.log({
            user_id: (user as any)?.id,
            action,
            ip_address: request.ip,
            request_method: request.method,
            endpoint: request.url,
            user_agent: request.get('user-agent'),
            payload: request.body,
            response_status: response.statusCode,
          });

          this.logger.debug(`Audit: ${action} by ${(user as any)?.email || 'anonymous'} (${responseTime}ms)`);
        },
        error: (error) => {
          // Queue error audit log asynchronously (non-blocking)
          this.auditService.log({
            user_id: (user as any)?.id,
            action: this.mapErrorAction(response.statusCode),
            ip_address: request.ip,
            endpoint: request.url,
            payload: { error: (error as Error).message },
            response_status: response.statusCode || 500,
          });
        },
      }),
    );
  }

  /**
   * Map HTTP method and URL to a meaningful audit action
   */
  private mapAction(method: string, url: string): string {
    // Remove query string for pattern matching
    const path = url.split('?')[0];
    const segments = path.split('/').filter(Boolean);
    const domain = segments[0]?.toUpperCase() || 'UNKNOWN';

    // Public endpoints
    if (path === '/pay') return AuditActions.PAYMENTS.VALIDATE_TOKEN;

    // Auth
    if (path.includes('/auth/register')) return AuditActions.AUTH.REGISTER;
    if (path.includes('/auth/refresh')) return AuditActions.AUTH.REFRESH_TOKEN;
    if (path.includes('/auth/logout')) return AuditActions.AUTH.LOGOUT;

    // Users
    if (path.includes('/users/me')) {
      return method === 'GET' ? AuditActions.USERS.GET_ME : AuditActions.USERS.UPDATE;
    }
    if (path.includes('/users/uuid/')) return AuditActions.USERS.GET_BY_ID;
    if (this.isIdSegment(path, '/users/')) {
      return method === 'GET' ? AuditActions.USERS.GET_BY_ID
        : method === 'PATCH' ? AuditActions.USERS.UPDATE
        : method === 'DELETE' ? AuditActions.USERS.DELETE
        : AuditActions.USERS.GET;
    }
    if (path.includes('/users')) {
      return method === 'GET' ? AuditActions.USERS.LIST
        : method === 'POST' ? AuditActions.USERS.CREATE
        : AuditActions.USERS.LIST;
    }

    // Merchants
    if (path.includes('/merchants/me')) return AuditActions.MERCHANTS.GET_ME;
    if (path.includes('/payment-link')) return AuditActions.MERCHANTS.GET_PAYMENT_LINK;
    if (path.includes('/cards')) return AuditActions.MERCHANTS.GET_CARDS;
    if (this.isIdSegment(path, '/merchants/')) {
      return method === 'GET' ? AuditActions.MERCHANTS.GET
        : method === 'PATCH' ? AuditActions.MERCHANTS.UPDATE
        : AuditActions.MERCHANTS.GET;
    }
    if (path.includes('/merchants')) {
      return method === 'GET' ? AuditActions.MERCHANTS.LIST
        : method === 'POST' ? AuditActions.MERCHANTS.CREATE
        : AuditActions.MERCHANTS.LIST;
    }

    // Payments
    if (path.includes('/session/')) return AuditActions.PAYMENTS.GET_BY_SESSION;
    if (path.includes('/merchant/') && path.includes('/statistics')) return AuditActions.PAYMENTS.GET_MERCHANT_STATS;
    if (path.includes('/merchant/')) return AuditActions.PAYMENTS.GET_MERCHANT_PAYMENTS;
    if (this.isIdSegment(path, '/payments/')) return AuditActions.PAYMENTS.GET_BY_ID;
    if (path.includes('/payments/stk')) return AuditActions.PAYMENTS.INITIATE_STK;
    if (path.includes('/payments')) {
      return method === 'GET' ? AuditActions.PAYMENTS.LIST
        : AuditActions.PAYMENTS.LIST;
    }

    // NFC
    if (path.includes('/nfc/decode')) return AuditActions.NFC.DECODE;
    if (this.isIdSegment(path, '/nfc/')) return AuditActions.NFC.GET_BY_ID;
    if (path.includes('/nfc')) {
      return method === 'GET' ? AuditActions.NFC.LIST
        : method === 'POST' ? AuditActions.NFC.CREATE
        : AuditActions.NFC.LIST;
    }

    // Ledger
    if (path.includes('/balance')) return AuditActions.LEDGER.GET_BALANCE;
    if (path.includes('/entries')) {
      return method === 'GET' ? AuditActions.LEDGER.LIST_ENTRIES
        : method === 'POST' ? AuditActions.LEDGER.CREATE_ENTRIES
        : AuditActions.LEDGER.LIST_ENTRIES;
    }

    // Notifications
    if (path.includes('/sms')) return AuditActions.NOTIFICATIONS.SEND_SMS;
    if (path.includes('/email')) return AuditActions.NOTIFICATIONS.SEND_EMAIL;
    if (path.includes('/push')) return AuditActions.NOTIFICATIONS.SEND_PUSH;
    if (path.includes('/notifications')) return AuditActions.NOTIFICATIONS.LIST;

    // Webhooks
    if (path.includes('/daraja/')) return AuditActions.WEBHOOKS.DARAJA_CALLBACK;
    if (path.includes('/africastalking/')) return AuditActions.WEBHOOKS.AFRICASTALKING_SMS;
    if (this.isIdSegment(path, '/webhooks/logs/')) return AuditActions.WEBHOOKS.GET_BY_ID;
    if (path.includes('/webhooks/logs')) return AuditActions.WEBHOOKS.LIST;
    if (path.includes('/webhooks')) return AuditActions.WEBHOOKS.LIST;

    // Queues
    if (path.includes('/retry')) return AuditActions.QUEUES.RETRY_JOB;
    if (path.includes('/clean')) return AuditActions.QUEUES.CLEAN;
    if (path.includes('/pause')) return AuditActions.QUEUES.PAUSE;
    if (path.includes('/resume')) return AuditActions.QUEUES.RESUME;
    if (path.includes('/jobs/')) return AuditActions.QUEUES.GET_JOB;
    if (path.includes('/jobs')) return AuditActions.QUEUES.GET_JOBS;
    if (this.isIdSegment(path, '/queues/')) return AuditActions.QUEUES.GET;
    if (path.includes('/queues')) return AuditActions.QUEUES.LIST;

    // Audit
    if (path.includes('/audit/logs')) return AuditActions.AUDIT.LIST_LOGS;

    // Health
    if (path.includes('/ready')) return AuditActions.HEALTH.READY;
    if (path.includes('/metrics')) return AuditActions.HEALTH.METRICS;
    if (path.includes('/version')) return AuditActions.HEALTH.VERSION;
    if (path.includes('/health')) return AuditActions.HEALTH.CHECK;

    // QR
    if (path.includes('/generate')) return AuditActions.QR.GENERATE;
    if (path.includes('/download/')) return AuditActions.QR.DOWNLOAD;
    if (path.includes('/qr/merchant/')) return AuditActions.QR.GET;
    if (path.includes('/qr')) return AuditActions.QR.GENERATE;

    // PDF
    if (path.includes('/card/generate')) return AuditActions.PDF.GENERATE_CARD;
    if (path.includes('/card')) return AuditActions.PDF.GET_CARD;
    if (path.includes('/pdf/download/')) return AuditActions.PDF.DOWNLOAD;
    if (path.includes('/pdf')) return AuditActions.PDF.GENERATE_CARD;

    // Admin
    if (path.includes('/admin/dashboard')) return AuditActions.ADMIN.DASHBOARD;
    if (path.includes('/admin/recent/payments')) return AuditActions.ADMIN.RECENT_PAYMENTS;
    if (path.includes('/admin/merchants/overview')) return AuditActions.ADMIN.MERCHANTS_OVERVIEW;

    // Default: Create descriptive action based on method and domain
    return this.getDefaultAction(method, segments);
  }

  /**
   * Generate a default action name based on HTTP method and URL segments
   */
  private getDefaultAction(method: string, segments: string[]): string {
    const domain = segments[0]?.toUpperCase() || 'UNKNOWN';
    
    // Map HTTP methods to descriptive action names
    const methodActions: Record<string, string> = {
      'GET': `${domain}.VIEW`,
      'POST': `${domain}.CREATE`,
      'PUT': `${domain}.UPDATE`,
      'PATCH': `${domain}.UPDATE`,
      'DELETE': `${domain}.DELETE`,
    };
    
    return methodActions[method] || `${domain}.${method}`;
  }

  /**
   * Map HTTP status code to error action
   */
  private mapErrorAction(statusCode: number): string {
    if (statusCode >= 500) return AuditActions.ERRORS.INTERNAL;
    if (statusCode === 404) return AuditActions.ERRORS.NOT_FOUND;
    if (statusCode === 403) return AuditActions.ERRORS.FORBIDDEN;
    if (statusCode === 401) return AuditActions.ERRORS.UNAUTHORIZED;
    if (statusCode === 400) return AuditActions.ERRORS.VALIDATION;
    return `ERRORS.HTTP_${statusCode}`;
  }

  /**
   * Check if URL contains an ID segment (e.g., /users/123, /merchants/456)
   */
  private isIdSegment(url: string, prefix: string): boolean {
    if (!url.startsWith(prefix)) return false;
    const remainder = url.substring(prefix.length);
    const firstSegment = remainder.split('/')[0];
    // Check if it looks like an ID (numeric or UUID)
    return /^\d+$/.test(firstSegment) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstSegment);
  }
}
