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
      AFRICASTALKING: this.configService.get<string[]>('AFRICASTALKING_IP_WHITELIST') || WEBHOOK_CONSTANTS.SECURITY.IP_WHITELIST.AFRICASTALKING || [],
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

      for (const range of whitelist) {
        if (range.includes('/')) {
          const [subnet, prefixLength] = range.split('/');
          const subnetAddr = ipaddr.parse(subnet);

          // Ensure both addresses are the same kind before calling match
          if (addr.kind() === subnetAddr.kind()) {
            if (addr.kind() === 'ipv4') {
              if ((addr as ipaddr.IPv4).match(subnetAddr as ipaddr.IPv4, parseInt(prefixLength))) {
                return true;
              }
            } else if (addr.kind() === 'ipv6') {
              if ((addr as ipaddr.IPv6).match(subnetAddr as ipaddr.IPv6, parseInt(prefixLength))) {
                return true;
              }
            }
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