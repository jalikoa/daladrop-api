import {
  HttpException,
  HttpStatus,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { RateLimitService } from './rate-limit.service';

interface AuthenticatedRequest extends Request {
  readonly user?: { readonly id?: string };
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  public constructor(
    private readonly limiter: RateLimitService,
    private readonly limit = 100,
    private readonly windowMs = 60_000,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // Never key on client-supplied X-Api-Key — unauthenticated callers can
    // rotate it to mint unlimited buckets. Prefer authenticated user, else IP.
    const result = await this.limiter.consume(
      this.limiter.key({
        userId: request.user?.id,
        ip: request.ip,
      }),
      this.limit,
      this.windowMs,
    );
    if (!result.allowed) {
      throw new HttpException(
        'Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
