import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Inject } from '@nestjs/common';
import { IDENTITY_REPOSITORY } from '../constants/auth.constants';
import { AuthTokenService } from '../domain/auth-token.service';
import type { AuthPrincipalView } from '../domain/auth.contracts';
import type { IdentityRepository } from '../repositories/identity.repository';

export interface AuthenticatedRequest extends Request {
  user?: AuthPrincipalView;
}

@Injectable()
export class AuthTokenGuard implements CanActivate {
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
    const principal = raw ? await this.tokens.verifyAccessToken(raw) : null;
    if (!principal) throw new UnauthorizedException('Authentication failed');

    const session = await this.repository.findSession(principal.sessionId);
    if (
      !session ||
      session.userId !== principal.id ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    const user = await this.repository.findUserById(principal.id);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    request.user = principal;
    return true;
  }
}
