import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../identity/guards/auth-token.guard';
import {
  REQUIRED_PERMISSION,
  type RequiredPermission,
} from '../decorators/require-permission.decorator';
import { AuthorizationService } from '../use-cases/authorization.service';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      REQUIRED_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      // Fail closed on admin controllers that omit @RequirePermission.
      const controller = context.getClass();
      const pathMeta = Reflect.getMetadata('path', controller) as
        | string
        | string[]
        | undefined;
      const path = Array.isArray(pathMeta) ? pathMeta.join('/') : (pathMeta ?? '');
      if (
        typeof path === 'string' &&
        (path === 'admin' ||
          path.startsWith('admin/') ||
          path.includes('/admin'))
      ) {
        throw new ForbiddenException(
          'Admin route is missing a required permission declaration',
        );
      }
      return true;
    }
    const principal = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>().user;
    if (
      !principal ||
      !(await this.authorization.can(
        principal,
        required.action,
        required.resource,
      ))
    ) {
      throw new ForbiddenException('Permission denied');
    }
    return true;
  }
}
