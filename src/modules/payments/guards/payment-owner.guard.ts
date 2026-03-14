import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../users/enums/user-role.enum';

@Injectable()
export class PaymentOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;
    const params = request.params;

    if (!user) throw new ForbiddenException('Authentication required');

    if (user.role === UserRole.ADMIN) return true;

    const paymentId = params.id || params.paymentId;
    if (paymentId && user.merchantId) return true;

    if (paymentId && user.phone) return true;

    throw new ForbiddenException('You can only access your own payments');
  }
}
