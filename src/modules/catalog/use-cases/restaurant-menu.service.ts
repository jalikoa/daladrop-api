import { Injectable, NotFoundException } from '@nestjs/common';
import { StoreType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';

@Injectable()
export class RestaurantMenuService {
  public constructor(private readonly prisma: PrismaService) {}

  public async getMenu(storeId: string, userId?: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        storeType: StoreType.RESTAURANT,
        isActive: true,
        deletedAt: null,
        merchant: { deletedAt: null, status: 'ACTIVE' },
      },
      select: { id: true, name: true },
    });
    if (!store) throw new NotFoundException('Restaurant not found');

    const [categories, items] = await Promise.all([
      this.prisma.menuCategory.findMany({
        where: { storeId, deletedAt: null, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true },
      }),
      this.prisma.menuItem.findMany({
        where: {
          storeId,
          deletedAt: null,
          isAvailable: true,
          menuCategory: { deletedAt: null, isActive: true },
        },
        include: {
          modifierGroups: {
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            include: {
              options: {
                where: { isAvailable: true },
                orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
              },
            },
          },
          ...(userId
            ? { favourites: { where: { userId }, select: { id: true } } }
            : {}),
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    ]);

    return {
      restaurant: store,
      categories,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: Number(item.priceAmount),
        imageUrl: item.imageUrl,
        categoryId: item.menuCategoryId,
        isAvailable: item.isAvailable,
        isFavourite:
          userId !== undefined &&
          'favourites' in item &&
          item.favourites.length > 0,
        modifiers: this.mapModifierGroups(item.modifierGroups),
        modifierGroups: this.mapModifierGroups(item.modifierGroups),
      })),
    };
  }

  private mapModifierGroups(
    groups: {
      id: string;
      name: string;
      minSelect: number;
      maxSelect: number;
      options: {
        id: string;
        name: string;
        priceDelta: unknown;
        isDefault: boolean;
        isAvailable: boolean;
      }[];
    }[],
  ) {
    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      options: group.options.map((option) => ({
        id: option.id,
        name: option.name,
        priceDelta: Number(option.priceDelta),
        isDefault: option.isDefault,
        isAvailable: option.isAvailable,
      })),
    }));
  }
}
