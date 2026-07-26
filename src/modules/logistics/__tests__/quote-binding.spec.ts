import { BadRequestException } from '@nestjs/common';
import { QuoteEngineService } from '../use-cases/quote-engine.service';

describe('QuoteEngineService.assertQuoteMatchesRequest', () => {
  const service = Object.create(
    QuoteEngineService.prototype,
  ) as QuoteEngineService;

  it('rejects coordinate swaps that would underpay delivery', () => {
    expect(() =>
      service.assertQuoteMatchesRequest(
        {
          storeId: 's1',
          serviceType: 'FOOD',
          requestSnapshot: {
            deliveryLat: -0.09,
            deliveryLng: 34.76,
          },
        },
        {
          storeId: 's1',
          deliveryLat: -0.5,
          deliveryLng: 34.76,
        },
      ),
    ).toThrow(BadRequestException);
  });

  it('accepts GPS-jitter within tolerance', () => {
    expect(() =>
      service.assertQuoteMatchesRequest(
        {
          storeId: 's1',
          serviceType: null,
          requestSnapshot: {
            pickupLat: -0.09,
            pickupLng: 34.76,
            dropoffLat: -0.1,
            dropoffLng: 34.75,
          },
        },
        {
          pickupLat: -0.0905,
          pickupLng: 34.7605,
          dropoffLat: -0.1004,
          dropoffLng: 34.7503,
        },
      ),
    ).not.toThrow();
  });

  it('rejects service-type mismatches', () => {
    expect(() =>
      service.assertQuoteMatchesRequest(
        {
          storeId: null,
          serviceType: 'PARCEL',
          requestSnapshot: {},
        },
        { serviceType: 'RIDE' },
      ),
    ).toThrow(/service type/i);
  });
});
