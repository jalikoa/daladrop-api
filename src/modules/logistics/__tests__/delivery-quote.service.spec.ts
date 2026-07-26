import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliveryQuoteService } from '../use-cases/delivery-quote.service';
import type { PrismaService } from '../../../database/prisma/prisma.service';

describe('DeliveryQuoteService over-max distance', () => {
  it('throws OVER_MAX_DISTANCE with suggestParcel when beyond constraint', async () => {
    const prisma = {
      appPricingConfig: { findFirst: jest.fn() },
      store: {
        findFirst: jest.fn().mockResolvedValue({
          id: 's1',
          latitude: -1.29,
          longitude: 36.82,
          deletedAt: null,
        }),
      },
      deliveryConstraint: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'c1',
          maxDistanceKm: 9,
          overflowServiceType: 'PARCEL',
        }),
      },
      deliveryPricingRule: { findMany: jest.fn() },
    } as unknown as PrismaService;

    const config = {
      get: () => undefined,
    } as unknown as ConfigService;

    const service = new DeliveryQuoteService(prisma, config);

    // ~15km away from store
    await expect(
      service.quoteNormalDelivery({
        storeId: 's1',
        deliveryLat: -1.42,
        deliveryLng: 36.82,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'OVER_MAX_DISTANCE',
        suggestParcel: true,
      }),
    });
    expect(prisma.deliveryPricingRule.findMany).not.toHaveBeenCalled();
  });

  it('maps vendor types to store types', () => {
    const service = new DeliveryQuoteService(
      {} as PrismaService,
      { get: () => undefined } as unknown as ConfigService,
    );
    expect(service.mapVendorType('food')).toBe('RESTAURANT');
    expect(service.mapVendorType('gas')).toBe('GAS');
    expect(() => service.mapVendorType('parcel')).toThrow(BadRequestException);
  });
});
