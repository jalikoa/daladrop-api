import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditAction, Prisma, ProductServiceType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';
import type {
  ProductAdminDto,
  UpdateProductAdminDto,
} from '../dto/catalog.dto';

@Injectable()
export class AdminProductsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: EventEmitter2,
  ) {}

  public async list(storeId: string) {
    await this.requireStore(storeId);
    const products = await this.prisma.product.findMany({
      where: { storeId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return products.map((product) => this.serialize(product));
  }

  public async get(storeId: string, productId: string) {
    const product = await this.requireProduct(storeId, productId);
    return this.serialize(product);
  }

  public async create(
    storeId: string,
    input: ProductAdminDto,
    actorId?: string,
  ) {
    await this.requireStore(storeId);
    if (input.categoryId) {
      await this.requireCategory(storeId, input.categoryId);
    }

    const created = await this.prisma.product.create({
      data: {
        storeId,
        categoryId: input.categoryId,
        cylinderTypeId: input.cylinderTypeId,
        name: input.name.trim(),
        description: input.description,
        brand: input.brand,
        sku: input.sku,
        priceAmount: BigInt(input.priceAmount),
        originalPrice:
          input.originalPrice !== undefined
            ? BigInt(input.originalPrice)
            : undefined,
        currency: input.currency,
        discountPercent: input.discountPercent,
        imageUrl: input.imageUrl,
        inStock: input.inStock,
        isActive: input.isActive,
        ageRestricted: input.ageRestricted,
        sizeLabel: input.sizeLabel,
        volumeLabel: input.volumeLabel,
        abv: input.abv,
        country: input.country,
        unitLabel: input.unitLabel,
        weightKg: input.weightKg,
        lengthCm: input.lengthCm,
        widthCm: input.widthCm,
        heightCm: input.heightCm,
        serviceType: input.serviceType,
        tags: input.tags,
        sortOrder: input.sortOrder,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    const serialized = this.serialize(created);
    await this.audit.record({
      tableName: 'products',
      recordId: created.id,
      action: AuditAction.INSERT,
      actorId,
      afterData: serialized,
    });
    this.events.emit('catalog.product.created', {
      productId: created.id,
      storeId,
      actorId,
    });
    return serialized;
  }

  public async update(
    storeId: string,
    productId: string,
    input: UpdateProductAdminDto,
    actorId?: string,
  ) {
    const existing = await this.requireProduct(storeId, productId);
    if (input.categoryId) {
      await this.requireCategory(storeId, input.categoryId);
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: this.toUpdateData(input),
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    const serialized = this.serialize(updated);
    await this.audit.record({
      tableName: 'products',
      recordId: productId,
      action: AuditAction.UPDATE,
      actorId,
      beforeData: this.serialize(existing),
      afterData: serialized,
    });
    this.events.emit('catalog.product.updated', {
      productId,
      storeId,
      actorId,
    });
    return serialized;
  }

  public async softDelete(
    storeId: string,
    productId: string,
    actorId?: string,
  ) {
    const existing = await this.requireProduct(storeId, productId);
    const deleted = await this.prisma.product.update({
      where: { id: productId },
      data: {
        deletedAt: new Date(),
        isActive: false,
        inStock: false,
        deletedBy: actorId ?? null,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    const serialized = this.serialize(deleted);
    await this.audit.record({
      tableName: 'products',
      recordId: productId,
      action: AuditAction.SOFT_DELETE,
      actorId,
      beforeData: this.serialize(existing),
      afterData: serialized,
    });
    this.events.emit('catalog.product.deleted', {
      productId,
      storeId,
      actorId,
    });
    return serialized;
  }

  private toUpdateData(
    input: UpdateProductAdminDto,
  ): Prisma.ProductUpdateInput {
    return {
      ...(input.categoryId !== undefined
        ? { category: { connect: { id: input.categoryId } } }
        : {}),
      ...(input.cylinderTypeId !== undefined
        ? input.cylinderTypeId
          ? { cylinderType: { connect: { id: input.cylinderTypeId } } }
          : { cylinderType: { disconnect: true } }
        : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
      ...(input.sku !== undefined ? { sku: input.sku } : {}),
      ...(input.priceAmount !== undefined
        ? { priceAmount: BigInt(input.priceAmount) }
        : {}),
      ...(input.originalPrice !== undefined
        ? {
            originalPrice:
              input.originalPrice === null
                ? null
                : BigInt(input.originalPrice),
          }
        : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.discountPercent !== undefined
        ? { discountPercent: input.discountPercent }
        : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.inStock !== undefined ? { inStock: input.inStock } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.ageRestricted !== undefined
        ? { ageRestricted: input.ageRestricted }
        : {}),
      ...(input.sizeLabel !== undefined ? { sizeLabel: input.sizeLabel } : {}),
      ...(input.volumeLabel !== undefined
        ? { volumeLabel: input.volumeLabel }
        : {}),
      ...(input.abv !== undefined ? { abv: input.abv } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.unitLabel !== undefined ? { unitLabel: input.unitLabel } : {}),
      ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
      ...(input.lengthCm !== undefined ? { lengthCm: input.lengthCm } : {}),
      ...(input.widthCm !== undefined ? { widthCm: input.widthCm } : {}),
      ...(input.heightCm !== undefined ? { heightCm: input.heightCm } : {}),
      ...(input.serviceType !== undefined
        ? { serviceType: input.serviceType as ProductServiceType }
        : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    };
  }

  private async requireStore(storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, deletedAt: null },
      select: { id: true, storeType: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  private async requireCategory(storeId: string, categoryId: string) {
    const store = await this.requireStore(storeId);
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        deletedAt: null,
        OR: [{ storeId }, { storeId: null }],
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return { store, category };
  }

  private async requireProduct(storeId: string, productId: string) {
    await this.requireStore(storeId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private serialize<
    T extends {
      priceAmount: bigint;
      originalPrice: bigint | null;
      abv?: unknown;
      weightKg?: unknown;
      lengthCm?: unknown;
      widthCm?: unknown;
      heightCm?: unknown;
    },
  >(product: T) {
    return {
      ...product,
      priceAmount: Number(product.priceAmount),
      originalPrice:
        product.originalPrice === null || product.originalPrice === undefined
          ? null
          : Number(product.originalPrice),
      abv:
        product.abv === null || product.abv === undefined
          ? null
          : Number(product.abv),
      weightKg:
        product.weightKg === null || product.weightKg === undefined
          ? null
          : Number(product.weightKg),
      lengthCm:
        product.lengthCm === null || product.lengthCm === undefined
          ? null
          : Number(product.lengthCm),
      widthCm:
        product.widthCm === null || product.widthCm === undefined
          ? null
          : Number(product.widthCm),
      heightCm:
        product.heightCm === null || product.heightCm === undefined
          ? null
          : Number(product.heightCm),
    };
  }
}
