import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  PermissionEvaluator,
  RbacEngine,
} from '../../../platform/security/authorization';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';

@Injectable()
export class AuthorizationService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacEngine,
    private readonly evaluator: PermissionEvaluator,
  ) {}

  public async can(
    principal: AuthPrincipalView,
    action: string,
    resource: string,
  ): Promise<boolean> {
    const roles = await this.prisma.role.findMany({
      where: { code: { in: principal.roles as never[] } },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
    for (const role of roles) {
      this.rbac.setRolePermissions(
        role.code,
        role.permissions.map(({ permission }) => ({
          action: permission.action,
          resource: permission.resource,
        })),
      );
    }
    return this.evaluator.can({
      principal: {
        id: principal.id,
        roles: principal.roles,
        attributes: { sessionId: principal.sessionId },
      },
      action,
      resource,
    });
  }
}
