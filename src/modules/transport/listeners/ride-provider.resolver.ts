import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Duplicated from `EventBookingProviderResolver` on purpose (see Phase 7 spec):
 * transport and events pick payment providers and normalize Kenyan phone
 * numbers the same way, but each module owns its copy rather than share a
 * cross-module dependency.
 */
@Injectable()
export class RideProviderResolver {
  public constructor(private readonly config: ConfigService) {}

  public resolveProviderCode(): string {
    if (this.config.get<string>('DARAJA_ENABLED') === 'true') {
      return 'MPESA_DARAJA';
    }
    if (this.config.get<string>('KOPOKOPO_ENABLED') === 'true') {
      return 'KOPOKOPO';
    }
    return 'MANUAL';
  }

  public normalizePhone(value?: string | null): string | null {
    if (!value) return null;
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('254') && digits.length === 12) return digits;
    if (digits.startsWith('0') && digits.length === 10) {
      return `254${digits.slice(1)}`;
    }
    if (
      digits.length === 9 &&
      (digits.startsWith('7') || digits.startsWith('1'))
    ) {
      return `254${digits}`;
    }
    return null;
  }

  public requirePhone(value?: string | null): string {
    const phone = this.normalizePhone(value);
    if (!phone) {
      throw new BadRequestException(
        'A valid Kenyan mpesaPhone is required to pay for a ride',
      );
    }
    return phone;
  }
}
