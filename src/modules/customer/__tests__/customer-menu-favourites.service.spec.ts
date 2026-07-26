import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomerMenuFavouritesService } from '../use-cases/customer-menu-favourites.service';
import type { PrismaService } from '../../../database/prisma/prisma.service';

describe('CustomerMenuFavouritesService', () => {
  it('lists favourites with menu item summaries', async () => {
    const prisma = {
      menuFavourite: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'f1',
            createdAt: new Date('2026-01-01T00:00:00Z'),
            menuItem: {
              id: 'i1',
              storeId: 's1',
              menuCategoryId: 'c1',
              name: 'Burger',
              description: 'Tasty',
              priceAmount: 530n,
              currency: 'KES',
              imageUrl: 'img',
              isAvailable: true,
              store: { id: 's1', name: 'Grill' },
            },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    } as unknown as PrismaService;
    const service = new CustomerMenuFavouritesService(prisma);
    await expect(service.list('u1', 'u1')).resolves.toEqual({
      success: true,
      items: [
        expect.objectContaining({
          id: 'i1',
          menuItemId: 'i1',
          name: 'Burger',
          price: 530,
          isFavourite: true,
        }),
      ],
      favorites: expect.any(Array),
      page: 1,
      hasMore: false,
      total: 1,
    });
    await expect(service.list('u1', 'u2')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('adds a favourite idempotently and rejects unknown menu items', async () => {
    const created = { id: 'f1', menuItemId: 'i1', createdAt: new Date() };
    const prisma = {
      menuItem: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'i1' })
          .mockResolvedValueOnce({ id: 'i1' })
          .mockResolvedValueOnce(null),
      },
      menuFavourite: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(created),
        create: jest.fn().mockResolvedValue(created),
      },
    } as unknown as PrismaService;
    const service = new CustomerMenuFavouritesService(prisma);

    const first = await service.add('u1', 'u1', 'i1');
    expect(first).toEqual({
      statusCode: 201,
      body: expect.objectContaining({ id: 'f1', menuItemId: 'i1' }),
    });
    expect(prisma.menuFavourite.create).toHaveBeenCalledWith({
      data: { userId: 'u1', menuItemId: 'i1' },
    });

    const duplicate = await service.add('u1', 'u1', 'i1');
    expect(duplicate.statusCode).toBe(200);

    await expect(service.add('u1', 'u1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.add('u1', 'u2', 'i1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('removes an existing favourite and 404s otherwise', async () => {
    const prisma = {
      menuFavourite: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'f1' })
          .mockResolvedValueOnce(null),
        delete: jest.fn().mockResolvedValue({ id: 'f1' }),
      },
    } as unknown as PrismaService;
    const service = new CustomerMenuFavouritesService(prisma);

    await expect(service.remove('u1', 'u1', 'i1')).resolves.toEqual({
      statusCode: 204,
    });
    expect(prisma.menuFavourite.delete).toHaveBeenCalledWith({
      where: { id: 'f1' },
    });

    await expect(service.remove('u1', 'u1', 'i1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.remove('u1', 'u2', 'i1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
