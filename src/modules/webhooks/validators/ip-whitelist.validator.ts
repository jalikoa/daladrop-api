import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WEBHOOK_CONSTANTS } from '../constants/webhook.constants';
import ipaddr from 'ipaddr.js';

@Injectable()
export class IpWhitelistValidator {
  private readonly logger = new Logger(IpWhitelistValidator.name);
  private readonly whitelists: Record<string, string[]>;

  constructor(private readonly configService: ConfigService) {
    this.whitelists = {
      DARAJA: this.configService.get<string[]>('DARAJA_IP_WHITELIST') || WEBHOOK_CONSTANTS.SECURITY.IP_WHITELIST.DARAJA,
    } as Record<string, string[]>;
  }

  validate(ip: string, source: string): boolean {
    const whitelist = this.whitelists[source];
    if (!whitelist || whitelist.length === 0) {
      this.logger.warn(`No IP whitelist configured for ${source}`);
      return true;
    }

    try {
      const addr = ipaddr.parse(ip);
      const addrKind = addr.kind();

      for (const range of whitelist) {
        if (range.includes('/')) {
          const [subnet, prefixLength] = range.split('/');
          const subnetAddr = ipaddr.parse(subnet);
          if (addrKind === subnetAddr.kind()) {
            if (addr.match(subnetAddr, parseInt(prefixLength))) return true;
          }
        } else {
          if (ip === range) return true;
        }
      }

      this.logger.warn(`IP ${ip} not in whitelist for ${source}`);
      return false;
    } catch (error) {
      this.logger.error('IP validation failed', error);
      return false;
    }
  }
}
