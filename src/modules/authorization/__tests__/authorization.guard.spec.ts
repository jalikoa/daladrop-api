import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationGuard } from '../guards/authorization.guard';
import type { AuthorizationService } from '../use-cases/authorization.service';

function executionContext(path: string, user?: { id: string }) {
  const request = { user };
  return {
    getHandler: () => ({}),
    getClass: () => {
      class Ctrl {}
      Reflect.defineMetadata('path', path, Ctrl);
      return Ctrl;
    },
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}

describe('AuthorizationGuard', () => {
  it('fails closed on admin routes missing @RequirePermission', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const authorization = { can: jest.fn() } as unknown as AuthorizationService;
    const guard = new AuthorizationGuard(reflector, authorization);
    await expect(
      guard.canActivate(executionContext('admin/users', { id: 'u1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(authorization.can).not.toHaveBeenCalled();
  });

  it('allows non-admin routes without permission metadata', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const authorization = { can: jest.fn() } as unknown as AuthorizationService;
    const guard = new AuthorizationGuard(reflector, authorization);
    await expect(
      guard.canActivate(executionContext('ride', { id: 'u1' })),
    ).resolves.toBe(true);
  });

  it('enforces required permissions when declared', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        action: 'read',
        resource: 'orders',
      }),
    } as unknown as Reflector;
    const authorization = {
      can: jest.fn().mockResolvedValue(true),
    } as unknown as AuthorizationService;
    const guard = new AuthorizationGuard(reflector, authorization);
    await expect(
      guard.canActivate(executionContext('admin/orders', { id: 'u1' })),
    ).resolves.toBe(true);
    expect(authorization.can).toHaveBeenCalled();

    (authorization.can as jest.Mock).mockResolvedValue(false);
    await expect(
      guard.canActivate(executionContext('admin/orders', { id: 'u1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
