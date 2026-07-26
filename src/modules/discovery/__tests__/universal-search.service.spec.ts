import { UniversalSearchService } from '../use-cases/universal-search.service';

describe('UniversalSearchService', () => {
  it('returns paginated items from indexed stores', async () => {
    const prisma = {
      store: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 's1',
            name: 'Nyama Choma Spot',
            description: 'Grills',
            storeType: 'RESTAURANT',
            merchant: { id: 'm1', name: 'Nyama Ltd' },
          },
        ]),
      },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      event: { findMany: jest.fn().mockResolvedValue([]) },
      courierPartner: { findMany: jest.fn().mockResolvedValue([]) },
      interCountyRoute: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new UniversalSearchService(prisma as never);
    const result = await service.search({ q: 'Nyama', scope: 'restaurants' });
    expect(result.success).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]?.name).toContain('Nyama');
  });

  it('returns autocomplete suggestions', async () => {
    const prisma = {
      store: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 's1',
            name: 'Pizza Palace',
            description: null,
            storeType: 'RESTAURANT',
            merchant: { id: 'm1', name: 'PP' },
          },
        ]),
      },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      event: { findMany: jest.fn().mockResolvedValue([]) },
      courierPartner: { findMany: jest.fn().mockResolvedValue([]) },
      interCountyRoute: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new UniversalSearchService(prisma as never);
    const result = await service.autocomplete({ q: 'piz' });
    expect(result.suggestions.some((s) => s.includes('pizza'))).toBe(true);
  });
});
