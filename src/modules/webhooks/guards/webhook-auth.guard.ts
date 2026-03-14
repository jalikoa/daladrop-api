import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IpWhitelistValidator } from '../validators/ip-whitelist.validator';

@Injectable()
export class WebhookAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly ipValidator: IpWhitelistValidator) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const source = this.reflector.get<string>('webhook_source', context.getHandler());

    if (!source) return true;

    const clientIp = this.getClientIp(request);
    const isIpValid = this.ipValidator.validate(clientIp, source);
    if (!isIpValid) {
      throw new UnauthorizedException(`IP ${clientIp} not authorized for ${source} webhooks`);
    }

    return true;
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
