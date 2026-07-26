import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StoreType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type {
  MenuCategoryDto,
  MenuItemDto,
  ModifierGroupDto,
  ModifierOptionDto,
  UpdateMenuCategoryDto,
  UpdateMenuItemDto,
  UpdateModifierGroupDto,
  UpdateModifierOptionDto,
} from '../dto/catalog.dto';

@Injectable()
export class AdminMenuService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private touchStore(storeId: string): void {
    this.events.emit('merchants.store.updated', {
      storeId,
      storeType: StoreType.RESTAURANT,
    });
  }

  public async getItemStoreId(itemId: string): Promise<string> {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: itemId, deletedAt: null },
      select: { storeId: true },
    });
    if (!item) throw new NotFoundException('Menu item not found');
    return item.storeId;
  }

  public async list(storeId: string) {
    await this.requireRestaurant(storeId);
    const [categories, items] = await Promise.all([
      this.prisma.menuCategory.findMany({
        where: { storeId, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.menuItem.findMany({
        where: { storeId, deletedAt: null },
        include: {
          modifierGroups: {
            include: { options: { orderBy: { sortOrder: 'asc' } } },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    ]);
    return {
      categories,
      items: items.map((item) => this.serializeItem(item)),
    };
  }

  public async listCategories(storeId: string) {
    await this.requireRestaurant(storeId);
    return this.prisma.menuCategory.findMany({
      where: { storeId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  public async listItems(storeId: string) {
    await this.requireRestaurant(storeId);
    const items = await this.prisma.menuItem.findMany({
      where: { storeId, deletedAt: null },
      include: {
        modifierGroups: {
          include: { options: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return items.map((item) => this.serializeItem(item));
  }

  public async createCategory(storeId: string, input: MenuCategoryDto) {
    await this.requireRestaurant(storeId);
    const category = await this.prisma.menuCategory.create({
      data: {
        storeId,
        name: input.name.trim(),
        description: input.description,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
    this.touchStore(storeId);
    return category;
  }

  public async updateCategory(
    storeId: string,
    categoryId: string,
    input: UpdateMenuCategoryDto,
  ) {
    await this.requireCategory(storeId, categoryId);
    const category = await this.prisma.menuCategory.update({
      where: { id: categoryId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    this.touchStore(storeId);
    return category;
  }

  public async deleteCategory(storeId: string, categoryId: string) {
    await this.requireCategory(storeId, categoryId);
    const now = new Date();
    const category = await this.prisma.$transaction(async (tx) => {
      await tx.menuItem.updateMany({
        where: { storeId, menuCategoryId: categoryId, deletedAt: null },
        data: { deletedAt: now, isAvailable: false },
      });
      return tx.menuCategory.update({
        where: { id: categoryId },
        data: { deletedAt: now, isActive: false },
      });
    });
    this.touchStore(storeId);
    return category;
  }

  public async createItem(storeId: string, input: MenuItemDto) {
    await this.requireCategory(storeId, input.menuCategoryId);
    const item = await this.prisma.menuItem.create({
      data: {
        storeId,
        menuCategoryId: input.menuCategoryId,
        name: input.name.trim(),
        description: input.description,
        priceAmount: BigInt(input.priceAmount),
        currency: input.currency,
        imageUrl: input.imageUrl,
        isAvailable: input.isAvailable,
        preparationTime: input.preparationTime,
        calories: input.calories,
        tags: input.tags,
        sortOrder: input.sortOrder,
      },
    });
    this.touchStore(storeId);
    return this.serializeItem(item);
  }

  public async updateItem(
    storeId: string,
    itemId: string,
    input: UpdateMenuItemDto,
  ) {
    await this.requireItem(storeId, itemId);
    if (input.menuCategoryId !== undefined) {
      await this.requireCategory(storeId, input.menuCategoryId);
    }
    const item = await this.prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...(input.menuCategoryId !== undefined
          ? { menuCategoryId: input.menuCategoryId }
          : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.priceAmount !== undefined
          ? { priceAmount: BigInt(input.priceAmount) }
          : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.isAvailable !== undefined
          ? { isAvailable: input.isAvailable }
          : {}),
        ...(input.preparationTime !== undefined
          ? { preparationTime: input.preparationTime }
          : {}),
        ...(input.calories !== undefined ? { calories: input.calories } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
    this.touchStore(storeId);
    return this.serializeItem(item);
  }

  public async deleteItem(storeId: string, itemId: string) {
    await this.requireItem(storeId, itemId);
    const item = await this.prisma.menuItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date(), isAvailable: false },
    });
    this.touchStore(storeId);
    return this.serializeItem(item);
  }

  public async createModifierGroup(
    storeId: string,
    itemId: string,
    input: ModifierGroupDto,
  ) {
    await this.requireItem(storeId, itemId);
    this.validateSelections(input.minSelect ?? 0, input.maxSelect ?? 1);
    return this.prisma.modifierGroup.create({
      data: {
        menuItemId: itemId,
        name: input.name.trim(),
        minSelect: input.minSelect,
        maxSelect: input.maxSelect,
        sortOrder: input.sortOrder,
      },
      include: { options: true },
    });
  }

  public async listModifierGroups(storeId: string, itemId: string) {
    await this.requireItem(storeId, itemId);
    const groups = await this.prisma.modifierGroup.findMany({
      where: { menuItemId: itemId },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return groups.map((group) => ({
      ...group,
      options: group.options.map((option) => this.serializeOption(option)),
    }));
  }

  public async updateModifierGroup(
    storeId: string,
    itemId: string,
    groupId: string,
    input: UpdateModifierGroupDto,
  ) {
    const group = await this.requireGroup(storeId, itemId, groupId);
    this.validateSelections(
      input.minSelect ?? group.minSelect,
      input.maxSelect ?? group.maxSelect,
    );
    return this.prisma.modifierGroup.update({
      where: { id: groupId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.minSelect !== undefined ? { minSelect: input.minSelect } : {}),
        ...(input.maxSelect !== undefined ? { maxSelect: input.maxSelect } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  public async deleteModifierGroup(
    storeId: string,
    itemId: string,
    groupId: string,
  ) {
    await this.requireGroup(storeId, itemId, groupId);
    return this.prisma.modifierGroup.delete({ where: { id: groupId } });
  }

  public async createModifierOption(
    storeId: string,
    itemId: string,
    groupId: string,
    input: ModifierOptionDto,
  ) {
    await this.requireGroup(storeId, itemId, groupId);
    const option = await this.prisma.modifierOption.create({
      data: {
        modifierGroupId: groupId,
        name: input.name.trim(),
        priceDelta:
          input.priceDelta !== undefined ? BigInt(input.priceDelta) : undefined,
        currency: input.currency,
        isDefault: input.isDefault,
        isAvailable: input.isAvailable,
        sortOrder: input.sortOrder,
      },
    });
    return this.serializeOption(option);
  }

  public async listModifierOptions(
    storeId: string,
    itemId: string,
    groupId: string,
  ) {
    await this.requireGroup(storeId, itemId, groupId);
    const options = await this.prisma.modifierOption.findMany({
      where: { modifierGroupId: groupId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return options.map((option) => this.serializeOption(option));
  }

  public async updateModifierOption(
    storeId: string,
    itemId: string,
    groupId: string,
    optionId: string,
    input: UpdateModifierOptionDto,
  ) {
    await this.requireOption(storeId, itemId, groupId, optionId);
    const option = await this.prisma.modifierOption.update({
      where: { id: optionId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.priceDelta !== undefined
          ? { priceDelta: BigInt(input.priceDelta) }
          : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.isDefault !== undefined
          ? { isDefault: input.isDefault }
          : {}),
        ...(input.isAvailable !== undefined
          ? { isAvailable: input.isAvailable }
          : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
    return this.serializeOption(option);
  }

  public async deleteModifierOption(
    storeId: string,
    itemId: string,
    groupId: string,
    optionId: string,
  ) {
    await this.requireOption(storeId, itemId, groupId, optionId);
    const option = await this.prisma.modifierOption.delete({
      where: { id: optionId },
    });
    return this.serializeOption(option);
  }

  private async requireRestaurant(storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        storeType: StoreType.RESTAURANT,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('Restaurant not found');
    return store;
  }

  private async requireCategory(storeId: string, categoryId: string) {
    await this.requireRestaurant(storeId);
    const category = await this.prisma.menuCategory.findFirst({
      where: { id: categoryId, storeId, deletedAt: null },
    });
    if (!category) throw new NotFoundException('Menu category not found');
    return category;
  }

  private async requireItem(storeId: string, itemId: string) {
    await this.requireRestaurant(storeId);
    const item = await this.prisma.menuItem.findFirst({
      where: { id: itemId, storeId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  private async requireGroup(
    storeId: string,
    itemId: string,
    groupId: string,
  ) {
    await this.requireItem(storeId, itemId);
    const group = await this.prisma.modifierGroup.findFirst({
      where: { id: groupId, menuItemId: itemId },
    });
    if (!group) throw new NotFoundException('Modifier group not found');
    return group;
  }

  private async requireOption(
    storeId: string,
    itemId: string,
    groupId: string,
    optionId: string,
  ) {
    await this.requireGroup(storeId, itemId, groupId);
    const option = await this.prisma.modifierOption.findFirst({
      where: { id: optionId, modifierGroupId: groupId },
    });
    if (!option) throw new NotFoundException('Modifier option not found');
    return option;
  }

  private validateSelections(minSelect: number, maxSelect: number) {
    if (minSelect > maxSelect) {
      throw new BadRequestException('minSelect cannot exceed maxSelect');
    }
  }

  private serializeOption<T extends { priceDelta: bigint }>(option: T) {
    return { ...option, priceDelta: Number(option.priceDelta) };
  }

  private serializeItem<T extends { priceAmount: bigint }>(item: T) {
    const result = { ...item, priceAmount: Number(item.priceAmount) };
    if (!('modifierGroups' in result)) return result;
    const groups = result.modifierGroups as Array<{
      options: Array<{ priceDelta: bigint }>;
    }>;
    return {
      ...result,
      modifierGroups: groups.map((group) => ({
        ...group,
        options: group.options.map((option) => this.serializeOption(option)),
      })),
    };
  }
}
