import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../guards/auth-token.guard';

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const principal = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>().user;
    if (!principal) throw new UnauthorizedException();
    return principal;
  },
);
