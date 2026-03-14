import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class UserOwnerGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;
    const params = request.params;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Admin can access all
    if ((user as any).role === 'ADMIN') {
      return true;
    }

    // Check if user owns the resource
    const userId = params.id || params.userId;
    if (userId && (user as any).id !== Number(userId)) {
      throw new ForbiddenException('You can only access your own resources');
    }

    return true;
  }
}
