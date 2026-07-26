import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ModuleType } from '@prisma/client';
import { ModuleOrdersService } from '../use-cases/module-orders.service';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import type { MultiCheckoutService } from '../use-cases/multi-checkout.service';

const actor = {
  id: 'cust-1',
  roles: ['CUSTOMER'],
  permissions: [],
  sessionId: 's1',
};

function baseOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    moduleType: 'FOOD',
    status: 'DELIVERED',
    paymentStatus: 'SUCCESS',
    customerId: 'cust-1',
    storeId: 'store-1',
    riderId: null,
    deliveryAddress: 'Somewhere',
    deliveryLatitude: -1.29,
    deliveryLongitude: 36.82,
    notes: null,
    subtotalAmount: 100n,
    deliveryFeeAmount: 10n,
    serviceFeeAmount: 5n,
    totalAmount: 115n,
    currency: 'KES',
    distanceKm: 2.1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    items: [],
    store: {
      id: 'store-1',
      name: 'Test Store',
      storeType: 'RESTAURANT',
      imageUrl: null,
      phone: null,
      address: null,
      city: null,
      latitude: null,
      longitude: null,
    },
    ...overrides,
  };
}

describe('ModuleOrdersService.getById delivery lat/lng aliases', () => {
  it('emits both deliveryLatitude/Longitude and deliveryLat/Lng', async () => {
    const order = baseOrder();
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(order) },
    } as unknown as PrismaService;
    const checkout = {} as unknown as MultiCheckoutService;
    const service = new ModuleOrdersService(prisma, checkout, new EventEmitter2());

    const view = await service.getById(ModuleType.FOOD, 'order-1', actor);

    expect(view.deliveryLatitude).toBe(-1.29);
    expect(view.deliveryLongitude).toBe(36.82);
    expect((view as unknown as { deliveryLat: number }).deliveryLat).toBe(-1.29);
    expect((view as unknown as { deliveryLng: number }).deliveryLng).toBe(36.82);
  });
});

describe('ModuleOrdersService.rate', () => {
  function buildPrisma(order: ReturnType<typeof baseOrder>) {
    return {
      order: { findFirst: jest.fn().mockResolvedValue(order) },
      review: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: `review-${data.targetType}`, ...data }),
        ),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _avg: { score: 4.5 }, _count: { score: 2 } }),
      },
      orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      rider: { update: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
  }

  it('accepts the legacy { score } body', async () => {
    const order = baseOrder();
    const prisma = buildPrisma(order);
    const checkout = {} as unknown as MultiCheckoutService;
    const service = new ModuleOrdersService(prisma, checkout, new EventEmitter2());

    const result = await service.rate(ModuleType.FOOD, 'order-1', actor, {
      score: 5,
    });

    expect(result.success).toBe(true);
    expect(result.score).toBe(5);
  });

  it.each([
    ['restaurantScore', { restaurantScore: 4 }],
    ['marketScore', { marketScore: 3 }],
    ['storeScore', { storeScore: 2 }],
  ])('accepts %s as an alias for score', async (_label, body) => {
    const order = baseOrder();
    const prisma = buildPrisma(order);
    const checkout = {} as unknown as MultiCheckoutService;
    const service = new ModuleOrdersService(prisma, checkout, new EventEmitter2());

    const result = await service.rate(ModuleType.FOOD, 'order-1', actor, body);

    expect(result.success).toBe(true);
    expect(result.score).toBe(Object.values(body)[0]);
  });

  it('rejects when no score alias is provided', async () => {
    const order = baseOrder();
    const prisma = buildPrisma(order);
    const checkout = {} as unknown as MultiCheckoutService;
    const service = new ModuleOrdersService(prisma, checkout, new EventEmitter2());

    await expect(
      service.rate(ModuleType.FOOD, 'order-1', actor, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a rider review and updates rider rating when riderScore is present and a rider is assigned', async () => {
    const order = baseOrder({ riderId: 'rider-1' });
    const prisma = buildPrisma(order);
    const checkout = {} as unknown as MultiCheckoutService;
    const service = new ModuleOrdersService(prisma, checkout, new EventEmitter2());

    const result = await service.rate(ModuleType.FOOD, 'order-1', actor, {
      score: 5,
      riderScore: 4,
    });

    expect(result.riderReviewId).toBe('review-RIDER');
    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetType: 'RIDER',
          riderId: 'rider-1',
          score: 4,
        }),
      }),
    );
    expect(prisma.rider.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rider-1' },
        data: { ratingAvg: 4.5, reviewCount: 2 },
      }),
    );
  });

  it('does not create a rider review when riderScore is present but no rider is assigned', async () => {
    const order = baseOrder({ riderId: null });
    const prisma = buildPrisma(order);
    const checkout = {} as unknown as MultiCheckoutService;
    const service = new ModuleOrdersService(prisma, checkout, new EventEmitter2());

    const result = await service.rate(ModuleType.FOOD, 'order-1', actor, {
      score: 5,
      riderScore: 4,
    });

    expect(result.riderReviewId).toBeUndefined();
    expect(prisma.review.create).toHaveBeenCalledTimes(1);
  });
});
