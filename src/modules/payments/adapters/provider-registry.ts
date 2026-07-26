import { Inject, Injectable } from '@nestjs/common';
import type { PaymentProvider } from '../domain/payment-provider';

export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers: ReadonlyMap<string, PaymentProvider>;

  public constructor(@Inject(PAYMENT_PROVIDERS) providers: readonly PaymentProvider[]) {
    const entries = providers.map((provider) => [provider.code.toUpperCase(), provider] as const);
    if (new Set(entries.map(([code]) => code)).size !== entries.length) {
      throw new Error('Duplicate payment provider code');
    }
    this.providers = new Map(entries);
  }

  public get(code: string): PaymentProvider {
    const provider = this.providers.get(code.toUpperCase());
    if (!provider) throw new Error(`Unknown payment provider: ${code}`);
    return provider;
  }

  public list(): readonly PaymentProvider[] {
    return [...this.providers.values()];
  }
}
