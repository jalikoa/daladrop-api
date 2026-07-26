import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PaginationService } from '../../../platform/api/pagination/pagination.service';

@Injectable()
export class CustomerMenuFavouritesService {
  private readonly pagination = new PaginationService(20, 100);

  public constructor(private readonly prisma: PrismaService) {}

  public async list(
    actorId: string,
    userId: string,
    query: { readonly page?: number; readonly limit?: number } = {},
  ) {
    this.assertSelf(actorId, userId);
    const { page, limit } = this.pagination.normalizeOffset({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
    const where = { userId, menuItem: { deletedAt: null } };
    const [total, rows] = await Promise.all([
      this.prisma.menuFavourite.count({ where }),
      this.prisma.menuFavourite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          menuItem: {
            select: {
              id: true,
              storeId: true,
              menuCategoryId: true,
              name: true,
              description: true,
              priceAmount: true,
              currency: true,
              imageUrl: true,
              isAvailable: true,
              store: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);
    const items = rows.map((row) => ({
      id: row.menuItem.id,
      menuItemId: row.menuItem.id,
      storeId: row.menuItem.storeId,
      categoryId: row.menuItem.menuCategoryId,
      name: row.menuItem.name,
      description: row.menuItem.description,
      price: Number(row.menuItem.priceAmount),
      currency: row.menuItem.currency,
      imageUrl: row.menuItem.imageUrl,
      isAvailable: row.menuItem.isAvailable,
      isFavourite: true,
      favouritedAt: row.createdAt,
      restaurant: {
        id: row.menuItem.store.id,
        name: row.menuItem.store.name,
      },
    }));
    return {
      success: true as const,
      items,
      favorites: items,
      page,
      hasMore: page * limit < total,
      total,
    };
  }

  public async add(actorId: string, userId: string, menuItemId: string) {
    this.assertSelf(actorId, userId);
    const menuItem = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, deletedAt: null },
      select: { id: true },
    });
    if (!menuItem) throw new NotFoundException('Menu item not found');

    const existing = await this.prisma.menuFavourite.findUnique({
      where: { userId_menuItemId: { userId, menuItemId } },
    });
    if (existing) {
      return {
        statusCode: 200 as const,
        body: {
          success: true as const,
          id: existing.id,
          menuItemId: existing.menuItemId,
          createdAt: existing.createdAt,
        },
      };
    }
    const created = await this.prisma.menuFavourite.create({
      data: { userId, menuItemId },
    });
    return {
      statusCode: 201 as const,
      body: {
        success: true as const,
        id: created.id,
        menuItemId: created.menuItemId,
        createdAt: created.createdAt,
      },
    };
  }

  public async remove(actorId: string, userId: string, menuItemId: string) {
    this.assertSelf(actorId, userId);
    const existing = await this.prisma.menuFavourite.findUnique({
      where: { userId_menuItemId: { userId, menuItemId } },
    });
    if (!existing) throw new NotFoundException('Favourite not found');
    await this.prisma.menuFavourite.delete({ where: { id: existing.id } });
    return { statusCode: 204 as const };
  }

  private assertSelf(actorId: string, userId: string): void {
    if (actorId !== userId) {
      throw new ForbiddenException('Cannot manage another user favourites');
    }
  }
}
