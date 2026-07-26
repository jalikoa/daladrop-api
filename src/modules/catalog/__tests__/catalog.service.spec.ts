import type { EventEmitter2 } from '@nestjs/event-emitter';
import { FoodCategoriesService } from '../use-cases/food-categories.service';
import { RestaurantMenuService } from '../use-cases/restaurant-menu.service';
import type { PrismaService } from '../../../database/prisma/prisma.service';

describe('FoodCategoriesService', () => {
  it('returns All first then active FOOD categories', async () => {
    const prisma = {
      category: {
        findMany: jest.fn().mockResolvedValue([
          {
            name: 'Fast Food',
            slug: 'fast-food',
            iconKey: 'fast-food-outline',
            imageUrl: 'img',
          },
        ]),
      },
      store: {
        findMany: jest.fn().mockResolvedValue([
          { tags: ['Fast Food'] },
          { tags: ['fast-food'] },
          { tags: ['Fast Food', 'Pizza'] },
        ]),
      },
    } as unknown as PrismaService;
    const events = { emit: jest.fn() } as unknown as EventEmitter2;
    const service = new FoodCategoriesService(prisma, events);
    const result = await service.listPublic();
    expect(result.categories[0]).toMatchObject({
      value: 'All',
      label: 'All',
      count: 3,
    });
    expect(result.categories[1]).toMatchObject({
      value: 'Fast Food',
      label: 'Fast Food',
      count: 3,
    });
  });
});

describe('RestaurantMenuService', () => {
  it('maps menu items with modifiers and prices', async () => {
    const prisma = {
      store: {
        findFirst: jest.fn().mockResolvedValue({ id: 's1', name: 'Java' }),
      },
      menuCategory: {
        findMany: jest.fn().mockResolvedValue([{ id: 'c1', name: 'Mains' }]),
      },
      menuItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'i1',
            name: 'Burger',
            description: 'Tasty',
            priceAmount: 530n,
            imageUrl: 'img',
            menuCategoryId: 'c1',
            isAvailable: true,
            favourites: [{ id: 'f1' }],
            modifierGroups: [
              {
                id: 'g1',
                name: 'Extras',
                minSelect: 0,
                maxSelect: 2,
                options: [
                  {
                    id: 'o1',
                    name: 'Cheese',
                    priceDelta: 50n,
                    isDefault: false,
                    isAvailable: true,
                  },
                ],
              },
            ],
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new RestaurantMenuService(prisma);
    const menu = await service.getMenu('s1', 'u1');
    expect(menu.categories).toHaveLength(1);
    expect(menu.items[0]).toMatchObject({
      price: 530,
      isFavourite: true,
      modifiers: [
        expect.objectContaining({
          options: [expect.objectContaining({ priceDelta: 50 })],
        }),
      ],
      modifierGroups: [
        expect.objectContaining({
          options: [expect.objectContaining({ priceDelta: 50 })],
        }),
      ],
    });
    expect(menu.items[0].modifierGroups).toEqual(menu.items[0].modifiers);
  });
});
