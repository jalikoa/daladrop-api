import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthConfig } from './auth.config';
import type { AuthPrincipalView } from './auth.contracts';

interface AccessClaims {
  readonly sub: string;
  readonly sid: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly typ: 'access';
  readonly iat?: number;
  readonly exp?: number;
}

@Injectable()
export class AuthTokenService {
  public constructor(
    private readonly jwt: JwtService,
    private readonly config: AuthConfig,
  ) {}

  public async issueAccessToken(
    principal: AuthPrincipalView,
  ): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(
      Date.now() + this.config.accessTtlSeconds * 1000,
    );
    const claims: AccessClaims = {
      sub: principal.id,
      sid: principal.sessionId,
      roles: principal.roles,
      permissions: principal.permissions,
      typ: 'access',
    };
    const token = await this.jwt.signAsync(claims, {
      secret: this.config.jwtSecret,
      expiresIn: this.config.accessTtlSeconds,
    });
    return { token, expiresAt };
  }

  public async verifyAccessToken(
    token: string,
  ): Promise<AuthPrincipalView | null> {
    try {
      const claims = await this.jwt.verifyAsync<AccessClaims>(token, {
        secret: this.config.jwtSecret,
      });
      if (
        claims.typ !== 'access' ||
        !claims.sub ||
        !claims.sid ||
        !Array.isArray(claims.roles) ||
        !Array.isArray(claims.permissions)
      ) {
        return null;
      }
      return {
        id: claims.sub,
        sessionId: claims.sid,
        roles: claims.roles,
        permissions: claims.permissions,
      };
    } catch {
      return null;
    }
  }

  public randomOpaqueToken(bytes = 48): string {
    return randomBytes(bytes).toString('base64url');
  }

  public hashOpaqueToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  public tokenMatches(value: string, digest: string): boolean {
    const actual = Buffer.from(this.hashOpaqueToken(value), 'hex');
    const expected = Buffer.from(digest, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }
}
