import { RestaurantDiscoveryService } from '../use-cases/restaurant-discovery.service';
import type { PrismaService } from '../../../database/prisma/prisma.service';

describe('RestaurantDiscoveryService', () => {
  it('filters, sorts and paginates restaurant cards', async () => {
    const store = {
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      name: 'Java Weston',
      city: 'Kisumu',
      imageUrl: 'logo',
      coverImageUrl: 'cover',
      latitude: -0.0917,
      longitude: 34.768,
      deliveryFeeHint: 150n,
      deliveryTimeMin: 20,
      deliveryTimeMax: 40,
      ratingAvg: 4.5,
      reviewCount: 10,
      isOpen: true,
      tags: ['Fast Food'],
      navigationRoute: null,
      openingHours: [
        {
          day: 'MON',
          openTime: '00:00',
          closeTime: '23:59',
          isClosed: false,
        },
      ],
      merchant: { featured: true },
    };
    const prisma = {
      store: {
        findMany: jest.fn().mockResolvedValue([store]),
      },
      savedItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;
    const service = new RestaurantDiscoveryService(prisma);
    const result = await service.list({
      discover: '1',
      page: '1',
      limit: '10',
      category: 'Fast Food',
      sort: 'rating',
      lat: '-0.09',
      lng: '34.76',
    });
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: store.id,
      name: 'Java Weston',
      category: 'Fast Food',
      deliveryFee: 150,
      isFavourite: false,
    });
    expect(result.items[0]!.distanceKm).toBeGreaterThanOrEqual(0);
  });
});
