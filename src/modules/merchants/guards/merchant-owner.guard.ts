import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserRole } from '../../users/enums/user-role.enum';

@Injectable()
export class MerchantOwnerGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;
    const params = request.params;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role === UserRole.ADMIN) {
      return true;
    }

    const merchantId = params.id || params.merchantId;
    if (merchantId && (user as any).merchantId && Number(merchantId) !== (user as any).merchantId) {
      throw new ForbiddenException('You can only access your own merchant profile');
    }

    return true;
  }
}
