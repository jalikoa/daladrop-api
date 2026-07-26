import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditAction, ModuleType, StoreType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';
import type {
  ModuleCategoryAdminDto,
  UpdateModuleCategoryAdminDto,
} from '../dto/catalog.dto';

const MODULE_TO_STORE: Partial<Record<ModuleType, StoreType>> = {
  [ModuleType.FOOD]: StoreType.RESTAURANT,
  [ModuleType.MARKET]: StoreType.MARKET,
  [ModuleType.LIQUOR]: StoreType.LIQUOR,
  [ModuleType.GAS]: StoreType.GAS,
};

@Injectable()
export class ModuleCategoriesService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: EventEmitter2,
  ) {}

  public async listPublic(moduleType: ModuleType, storeType?: StoreType) {
    const resolvedStoreType = storeType ?? MODULE_TO_STORE[moduleType];
    if (!resolvedStoreType) {
      throw new BadRequestException(
        `No store type mapping for module ${moduleType}`,
      );
    }

    const categories = await this.prisma.category.findMany({
      where: {
        moduleType,
        storeId: null,
        deletedAt: null,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const categoryViews = await Promise.all(
      categories.map(async (category) => {
        const count = await this.prisma.store.count({
          where: {
            storeType: resolvedStoreType,
            isActive: true,
            deletedAt: null,
            OR: [
              { tags: { has: category.name } },
              { tags: { has: category.slug } },
              {
                categories: {
                  some: {
                    deletedAt: null,
                    isActive: true,
                    OR: [
                      { id: category.id },
                      { slug: category.slug },
                      { name: { equals: category.name, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          },
        });
        return {
          id: category.id,
          value: category.name,
          label: category.name,
          name: category.name,
          slug: category.slug,
          ...(category.imageUrl ? { imageUrl: category.imageUrl } : { imageUrl: '' }),
          ...(category.iconKey ? { icon: category.iconKey } : {}),
          count,
          itemCount: count,
        };
      }),
    );

    const total = await this.prisma.store.count({
      where: {
        storeType: resolvedStoreType,
        isActive: true,
        deletedAt: null,
      },
    });

    return {
      categories: [
        {
          id: 'all',
          value: 'All',
          label: 'All',
          name: 'All',
          slug: 'all',
          imageUrl: '',
          icon: 'apps',
          count: total,
          itemCount: total,
        },
        ...categoryViews,
      ],
    };
  }

  public listAdmin(moduleType: ModuleType) {
    return this.prisma.category.findMany({
      where: {
        moduleType,
        storeId: null,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  public async create(input: ModuleCategoryAdminDto, actorId?: string) {
    const moduleType = input.moduleType;
    const slug = this.slugify(input.slug ?? input.name);
    await this.ensureSlugAvailable(moduleType, slug);
    const created = await this.prisma.category.create({
      data: {
        moduleType,
        storeId: null,
        name: input.name.trim(),
        slug,
        iconKey: input.iconKey,
        imageUrl: input.imageUrl,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
    await this.audit.record({
      tableName: 'categories',
      recordId: created.id,
      action: AuditAction.INSERT,
      actorId,
      afterData: created,
      reason: 'Admin module category create',
    });
    this.events.emit('catalog.module_category.created', {
      categoryId: created.id,
      moduleType,
      actorId,
    });
    return created;
  }

  public async update(
    id: string,
    input: UpdateModuleCategoryAdminDto,
    actorId?: string,
  ) {
    const category = await this.findAdminCategory(id, input.moduleType);
    const moduleType = category.moduleType;
    const slug =
      input.slug !== undefined
        ? this.slugify(input.slug)
        : input.name !== undefined
          ? this.slugify(input.name)
          : undefined;
    if (slug && slug !== category.slug) {
      await this.ensureSlugAvailable(moduleType, slug, id);
    }

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
    await this.audit.record({
      tableName: 'categories',
      recordId: updated.id,
      action: AuditAction.UPDATE,
      actorId,
      beforeData: category,
      afterData: updated,
      reason: 'Admin module category update',
    });
    this.events.emit('catalog.module_category.updated', {
      categoryId: updated.id,
      moduleType,
      actorId,
    });
    return updated;
  }

  public async softDelete(
    id: string,
    moduleType?: ModuleType,
    actorId?: string,
  ) {
    await this.findAdminCategory(id, moduleType);
    const updated = await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.record({
      tableName: 'categories',
      recordId: id,
      action: AuditAction.SOFT_DELETE,
      actorId,
      reason: 'Admin module category soft-delete',
    });
    this.events.emit('catalog.module_category.deleted', {
      categoryId: id,
      actorId,
    });
    return updated;
  }

  private async findAdminCategory(id: string, moduleType?: ModuleType) {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        storeId: null,
        deletedAt: null,
        ...(moduleType ? { moduleType } : {}),
      },
    });
    if (!category) throw new NotFoundException('Module category not found');
    return category;
  }

  private async ensureSlugAvailable(
    moduleType: ModuleType,
    slug: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.category.findFirst({
      where: {
        moduleType,
        storeId: null,
        slug,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Module category slug already exists');
    }
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
