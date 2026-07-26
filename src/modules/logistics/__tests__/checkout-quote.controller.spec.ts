import { BadRequestException } from '@nestjs/common';
import { CheckoutQuoteController } from '../interfaces/checkout-quote.controller';
import type { QuoteEngineService } from '../use-cases/quote-engine.service';

function buildQuotes(quoteCheckout = jest.fn()) {
  return { quoteCheckout } as unknown as QuoteEngineService;
}

const principal = {
  id: 'cust-1',
  roles: ['CUSTOMER'],
  permissions: [],
  sessionId: 's1',
};

describe('CheckoutQuoteController lat/lng aliases', () => {
  const quoteResult = {
    success: true as const,
    quoteId: 'pq-1',
    amounts: { deliveryFee: 120, serviceFee: 14, total: 134 },
  };

  it('prefers deliveryLat/deliveryLng when both lat/lng and delivery aliases are present', async () => {
    const quoteCheckout = jest.fn().mockResolvedValue(quoteResult);
    const controller = new CheckoutQuoteController(buildQuotes(quoteCheckout));

    await controller.quote(principal as never, {
      vendorType: 'food',
      vendorId: 'store-1',
      items: [],
      lat: 1,
      lng: 2,
      deliveryLat: -1.29,
      deliveryLng: 36.82,
    } as never);

    expect(quoteCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-1',
        deliveryLat: -1.29,
        deliveryLng: 36.82,
      }),
    );
  });

  it('falls back to lat/lng when delivery aliases are absent', async () => {
    const quoteCheckout = jest.fn().mockResolvedValue(quoteResult);
    const controller = new CheckoutQuoteController(buildQuotes(quoteCheckout));

    await controller.quote(principal as never, {
      vendorType: 'food',
      vendorId: 'store-1',
      items: [],
      lat: -1.29,
      lng: 36.82,
    } as never);

    expect(quoteCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryLat: -1.29, deliveryLng: 36.82 }),
    );
  });

  it('rejects when neither lat/lng nor deliveryLat/deliveryLng is present', async () => {
    const quoteCheckout = jest.fn();
    const controller = new CheckoutQuoteController(buildQuotes(quoteCheckout));

    await expect(
      controller.quote(principal as never, {
        vendorType: 'food',
        vendorId: 'store-1',
        items: [],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(quoteCheckout).not.toHaveBeenCalled();
  });
});
