import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ModuleType, StoreType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type {
  FoodCategoryAdminDto,
  UpdateFoodCategoryAdminDto,
} from '../dto/catalog.dto';

@Injectable()
export class FoodCategoriesService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  public async listPublic() {
    const categories = await this.prisma.category.findMany({
      where: {
        moduleType: ModuleType.FOOD,
        storeId: null,
        deletedAt: null,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const restaurants = await this.prisma.store.findMany({
      where: {
        storeType: StoreType.RESTAURANT,
        isActive: true,
        deletedAt: null,
        merchant: { deletedAt: null, status: 'ACTIVE' },
      },
      select: { tags: true },
    });
    const total = restaurants.length;

    const categoryViews = categories.map((category) => {
      const count = restaurants.filter(
        (store) =>
          store.tags.includes(category.name) ||
          store.tags.includes(category.slug),
      ).length;
      return {
        value: category.name,
        label: category.name,
        ...(category.imageUrl ? { imageUrl: category.imageUrl } : {}),
        ...(category.iconKey ? { icon: category.iconKey } : {}),
        count,
      };
    });

    return {
      categories: [{ value: 'All', label: 'All', count: total }, ...categoryViews],
    };
  }

  public listAdmin() {
    return this.prisma.category.findMany({
      where: {
        moduleType: ModuleType.FOOD,
        storeId: null,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  public async create(input: FoodCategoryAdminDto) {
    const slug = this.slugify(input.slug ?? input.name);
    await this.ensureSlugAvailable(slug);
    const category = await this.prisma.category.create({
      data: {
        moduleType: ModuleType.FOOD,
        storeId: null,
        name: input.name.trim(),
        slug,
        iconKey: input.iconKey,
        imageUrl: input.imageUrl,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
    this.events.emit('catalog.module_category.created', {
      categoryId: category.id,
      moduleType: ModuleType.FOOD,
    });
    return category;
  }

  public async update(id: string, input: UpdateFoodCategoryAdminDto) {
    const category = await this.findAdminCategory(id);
    const slug =
      input.slug !== undefined
        ? this.slugify(input.slug)
        : input.name !== undefined
          ? this.slugify(input.name)
          : undefined;
    if (slug && slug !== category.slug) await this.ensureSlugAvailable(slug, id);

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    this.events.emit('catalog.module_category.updated', {
      categoryId: updated.id,
      moduleType: ModuleType.FOOD,
    });
    return updated;
  }

  public async softDelete(id: string) {
    await this.findAdminCategory(id);
    const deleted = await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    this.events.emit('catalog.module_category.deleted', {
      categoryId: deleted.id,
      moduleType: ModuleType.FOOD,
    });
    return deleted;
  }

  private async findAdminCategory(id: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        moduleType: ModuleType.FOOD,
        storeId: null,
        deletedAt: null,
      },
    });
    if (!category) throw new NotFoundException('Food category not found');
    return category;
  }

  private async ensureSlugAvailable(slug: string, excludeId?: string) {
    const existing = await this.prisma.category.findFirst({
      where: {
        moduleType: ModuleType.FOOD,
        storeId: null,
        slug,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Food category slug already exists');
  }

  private slugify(value: string): string {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) throw new ConflictException('A valid category slug is required');
    return slug;
  }
}
