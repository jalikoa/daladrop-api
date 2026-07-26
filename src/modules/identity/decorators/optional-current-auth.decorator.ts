import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../guards/auth-token.guard';
import type { AuthPrincipalView } from '../domain/auth.contracts';

/** Returns the authenticated principal when present; otherwise `undefined`. */
export const OptionalCurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipalView | undefined => {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  },
);
