import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { IDENTITY_REPOSITORY } from '../constants/auth.constants';
import { AuthTokenService } from '../domain/auth-token.service';
import type { IdentityRepository } from '../repositories/identity.repository';
import type { AuthenticatedRequest } from './auth-token.guard';

/**
 * Attaches a principal when a valid Bearer token is present; never rejects.
 * Use on public discovery endpoints that personalise (`isFavourite`) when logged in.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  public constructor(
    private readonly tokens: AuthTokenService,
    @Inject(IDENTITY_REPOSITORY)
    private readonly repository: IdentityRepository,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const raw = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';
    if (!raw) return true;

    const principal = await this.tokens.verifyAccessToken(raw);
    if (!principal) return true;

    const session = await this.repository.findSession(principal.sessionId);
    if (
      !session ||
      session.userId !== principal.id ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      return true;
    }

    const user = await this.repository.findUserById(principal.id);
    if (!user || user.status !== 'ACTIVE') return true;

    request.user = principal;
    return true;
  }
}
