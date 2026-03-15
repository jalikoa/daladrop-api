import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Checks Authorization: Bearer <METRICS_TOKEN> header on /metrics.
 * Prometheus scraper is configured with bearer_token in prometheus.yml.
 * Falls through (allows) when METRICS_TOKEN is not configured — safe for
 * local development, but METRICS_TOKEN must be set in production.
 */
@Injectable()
export class MetricsAuthGuard implements CanActivate {
  private readonly token: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.token = configService.get<string>('METRICS_TOKEN');
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.token) return true;   // dev: no token required

    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers['authorization'] || '';
    const provided = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!provided || provided !== this.token) {
      throw new UnauthorizedException('Invalid metrics token');
    }

    return true;
  }
}