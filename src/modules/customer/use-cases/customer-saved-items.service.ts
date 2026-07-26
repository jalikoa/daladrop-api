import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SavedItemKind } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PaginationService } from '../../../platform/api/pagination/pagination.service';

const KIND_MAP: Record<string, SavedItemKind> = {
  restaurant: SavedItemKind.RESTAURANT,
  merchant: SavedItemKind.MERCHANT,
  event: SavedItemKind.EVENT,
  market: SavedItemKind.MARKET,
  product: SavedItemKind.PRODUCT,
};

@Injectable()
export class CustomerSavedItemsService {
  private readonly pagination = new PaginationService(20, 100);

  public constructor(private readonly prisma: PrismaService) {}

  public async list(
    actorId: string,
    userId: string,
    type: string,
    query: { readonly page?: number; readonly limit?: number } = {},
  ) {
    this.assertSelf(actorId, userId);
    const kind = this.kind(type);
    const { page, limit } = this.pagination.normalizeOffset({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
    const where = { userId, kind };
    const [total, rows] = await Promise.all([
      this.prisma.savedItem.count({ where }),
      this.prisma.savedItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      success: true as const,
      items: rows.map((row) => ({
        id: row.id,
        type: type.toLowerCase(),
        targetId: row.targetId,
        createdAt: row.createdAt,
      })),
      page,
      hasMore: page * limit < total,
      total,
    };
  }

  public async add(
    actorId: string,
    userId: string,
    type: string,
    targetId: string,
  ) {
    this.assertSelf(actorId, userId);
    const kind = this.kind(type);
    await this.assertTargetExists(kind, targetId);
    const existing = await this.prisma.savedItem.findUnique({
      where: {
        userId_kind_targetId: { userId, kind, targetId },
      },
    });
    if (existing) {
      return {
        statusCode: 200 as const,
        body: {
          id: existing.id,
          type: type.toLowerCase(),
          targetId: existing.targetId,
        },
      };
    }
    const created = await this.prisma.savedItem.create({
      data: { userId, kind, targetId },
    });
    return {
      statusCode: 201 as const,
      body: {
        id: created.id,
        type: type.toLowerCase(),
        targetId: created.targetId,
      },
    };
  }

  public async remove(
    actorId: string,
    userId: string,
    type: string,
    targetId: string,
  ) {
    this.assertSelf(actorId, userId);
    const kind = this.kind(type);
    const existing = await this.prisma.savedItem.findUnique({
      where: {
        userId_kind_targetId: { userId, kind, targetId },
      },
    });
    if (!existing) throw new NotFoundException('Favourite not found');
    await this.prisma.savedItem.delete({ where: { id: existing.id } });
    return { statusCode: 204 as const };
  }

  private assertSelf(actorId: string, userId: string): void {
    if (actorId !== userId) {
      throw new ForbiddenException('Cannot manage another user favourites');
    }
  }

  private kind(type: string): SavedItemKind {
    const mapped = KIND_MAP[type.toLowerCase()];
    if (!mapped) throw new NotFoundException('Unsupported saved item type');
    return mapped;
  }

  private async assertTargetExists(
    kind: SavedItemKind,
    targetId: string,
  ): Promise<void> {
    const exists = await this.targetExists(kind, targetId);
    if (!exists) throw new NotFoundException('Saved item target not found');
  }

  private async targetExists(
    kind: SavedItemKind,
    targetId: string,
  ): Promise<boolean> {
    switch (kind) {
      case SavedItemKind.RESTAURANT:
      case SavedItemKind.MARKET:
      case SavedItemKind.MERCHANT: {
        const store = await this.prisma.store.findFirst({
          where: { id: targetId, deletedAt: null },
          select: { id: true },
        });
        if (store) return true;
        if (kind !== SavedItemKind.MERCHANT) return false;
        const merchant = await this.prisma.merchant.findFirst({
          where: { id: targetId, deletedAt: null },
          select: { id: true },
        });
        return Boolean(merchant);
      }
      case SavedItemKind.EVENT: {
        const event = await this.prisma.event.findFirst({
          where: { id: targetId, deletedAt: null },
          select: { id: true },
        });
        return Boolean(event);
      }
      case SavedItemKind.PRODUCT: {
        const product = await this.prisma.product.findFirst({
          where: { id: targetId, deletedAt: null },
          select: { id: true },
        });
        return Boolean(product);
      }
      default:
        return false;
    }
  }
}
