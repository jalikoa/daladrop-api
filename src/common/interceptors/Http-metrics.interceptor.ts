import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Request, Response } from 'express';
import { MetricsService } from '../modules/metrics/metrics.service';
import { AppLogger } from '../modules/logger/logger.service';

/**
 * Global HTTP Metrics and Logging Interceptor
 * 
 * Fires Prometheus counters and histograms for every request.
 * Writes one structured log line per request for observability.
 * 
 * Registration: app.useGlobalInterceptors(new HttpMetricsInterceptor(...))
 * in main.ts.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metrics: MetricsService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const method = req.method;
    
    /**
     * Normalise the route to prevent Prometheus label cardinality explosion.
     * Falls back to req.url if req.route is undefined (e.g., unmatched routes),
     * which is then cleaned by the normaliseRoute method.
     */
    const route = this.normaliseRoute(req.route?.path || req.url);
    const startMs = Date.now();
    const userId = (req as any).user?.id;
    const requestId = (req.headers['x-request-id'] as string) || undefined;

    /**
     * Skip the Prometheus scrape endpoint to prevent recursive metric generation.
     */
    if (req.url === '/metrics') {
      return next.handle();
    }

    this.metrics.httpRequestsInFlight.inc({ method });

    return next.handle().pipe(
      tap(() => {
        const statusCode = res.statusCode;
        const durationMs = Date.now() - startMs;
        const durationSec = durationMs / 1000;

        this.metrics.httpRequestsInFlight.dec({ method });
        this.metrics.httpRequestsTotal.inc({ method, route, status_code: String(statusCode) });
        this.metrics.httpRequestDuration.observe({ method, route, status_code: String(statusCode) }, durationSec);

        if (statusCode >= 400) {
          this.metrics.httpErrorsTotal.inc({ method, route, status_code: String(statusCode) });
        }

        this.logger.logRequest({
          method,
          url: req.url,
          statusCode,
          durationMs,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          userId,
          requestId,
        });
      }),

      catchError((err) => {
        /**
         * If an error is thrown, we must still record the metrics before 
         * passing the error down the chain to the Global Exception Filter.
         */
        const statusCode = err?.status || 500;
        const durationMs = Date.now() - startMs;
        const durationSec = durationMs / 1000;

        this.metrics.httpRequestsInFlight.dec({ method });
        this.metrics.httpRequestsTotal.inc({ method, route, status_code: String(statusCode) });
        this.metrics.httpRequestDuration.observe({ method, route, status_code: String(statusCode) }, durationSec);
        this.metrics.httpErrorsTotal.inc({ method, route, status_code: String(statusCode) });

        this.logger.error(
          `${method} ${req.url} → ${statusCode} (${durationMs}ms): ${err?.message}`,
          err?.stack,
          { type: 'http_error', statusCode, route, durationMs, userId, requestId },
        );

        return throwError(() => err);
      }),
    );
  }

  /**
   * Normalise parameterised paths so Prometheus label cardinality stays low.
   * 
   * Examples:
   * /payments/12345       → /payments/:id
   * /users/uuid/550e...   → /users/uuid/:uuid
   * /api/test?foo=bar     → /api/test
   */
  private normaliseRoute(path: string): string {
    return path
      .replace(/\/[0-9]+/g, '/:id')
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
      .replace(/\?.*$/, '');
  }
}