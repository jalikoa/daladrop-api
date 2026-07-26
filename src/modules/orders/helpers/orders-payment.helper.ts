import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OrdersPaymentHelper {
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
        'A valid Kenyan mpesaPhone / phone is required for payment',
      );
    }
    return phone;
  }

  public stkOnPlaceEnabled(): boolean {
    return this.config.get<string>('ORDERS_STK_ON_PLACE') === 'true';
  }
}
