import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ActorType,
  ModuleOrderStatus,
  ModuleType,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PaginationService } from '../../../platform/api/pagination/pagination.service';
import { ProofOfDeliveryService } from '../../logistics/use-cases/proof-of-delivery.service';

const MERCHANT_TRANSITIONS: Readonly<
  Partial<Record<ModuleOrderStatus, readonly ModuleOrderStatus[]>>
> = {
  [ModuleOrderStatus.PAID]: [ModuleOrderStatus.ACCEPTED, ModuleOrderStatus.CANCELLED],
  [ModuleOrderStatus.ACCEPTED]: [
    ModuleOrderStatus.PREPARING,
    ModuleOrderStatus.READY,
    ModuleOrderStatus.CANCELLED,
  ],
  [ModuleOrderStatus.PREPARING]: [
    ModuleOrderStatus.READY,
    ModuleOrderStatus.CANCELLED,
  ],
  [ModuleOrderStatus.READY]: [
    ModuleOrderStatus.PICKED_UP,
    ModuleOrderStatus.ON_THE_WAY,
  ],
  [ModuleOrderStatus.PICKED_UP]: [ModuleOrderStatus.ON_THE_WAY, ModuleOrderStatus.DELIVERED],
  [ModuleOrderStatus.ON_THE_WAY]: [ModuleOrderStatus.DELIVERED],
};

@Injectable()
export class MerchantOrdersService {
  private readonly pagination = new PaginationService(20, 100);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly pod: ProofOfDeliveryService,
  ) {}

  public async listMine(
    ownerUserId: string,
    query: {
      readonly storeId?: string;
      readonly status?: ModuleOrderStatus;
      readonly page?: number;
      readonly limit?: number;
    } = {},
  ) {
    const storeIds = await this.ownedStoreIds(ownerUserId, query.storeId);
    const { page, limit } = this.pagination.normalizeOffset({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
    const where = {
      storeId: { in: [...storeIds] },
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          store: { select: { id: true, name: true, storeType: true } },
        },
      }),
    ]);
    return {
      success: true as const,
      items: rows.map((order) => ({
        id: order.id,
        moduleType: order.moduleType,
        status: order.status,
        paymentStatus: order.paymentStatus,
        storeId: order.storeId,
        store: order.store,
        customer: order.customer,
        total: Number(order.totalAmount),
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
      })),
      page,
      hasMore: page * limit < total,
      total,
    };
  }

  public async getMine(ownerUserId: string, orderId: string) {
    const order = await this.requireOwnedOrder(ownerUserId, orderId);
    return {
      success: true as const,
      order: {
        id: order.id,
        moduleType: order.moduleType,
        status: order.status,
        paymentStatus: order.paymentStatus,
        storeId: order.storeId,
        total: Number(order.totalAmount),
        currency: order.currency,
        deliveryAddress: order.deliveryAddress,
        notes: order.notes,
        createdAt: order.createdAt.toISOString(),
      },
    };
  }

  public async updateStatus(
    ownerUserId: string,
    orderId: string,
    status: ModuleOrderStatus,
    reason?: string,
    pod?: {
      readonly photoUrl?: string;
      readonly signatureUrl?: string;
      readonly recipientName?: string;
      readonly notes?: string;
      readonly otpCode?: string;
      readonly latitude?: number;
      readonly longitude?: number;
    },
  ) {
    const order = await this.requireOwnedOrder(ownerUserId, orderId);
    const allowed = MERCHANT_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition merchant order from ${order.status} to ${status}`,
      );
    }

    const now = new Date();
    const data: Record<string, unknown> = {
      status,
      updatedBy: ownerUserId,
    };
    if (status === ModuleOrderStatus.ACCEPTED) data.acceptedAt = now;
    if (status === ModuleOrderStatus.PREPARING) data.preparedAt = now;
    if (status === ModuleOrderStatus.READY) data.readyAt = now;
    if (status === ModuleOrderStatus.PICKED_UP) data.pickedUpAt = now;
    if (status === ModuleOrderStatus.DELIVERED) data.deliveredAt = now;
    if (status === ModuleOrderStatus.CANCELLED) {
      data.cancelledAt = now;
      data.cancelReason = reason ?? 'Cancelled by merchant';
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: data as never });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: status,
          actorType: ActorType.USER,
          actorId: ownerUserId,
          reason: reason ?? `Merchant set status to ${status}`,
        },
      });
    });

    if (status === ModuleOrderStatus.DELIVERED && pod) {
      await this.pod.submit({
        orderId,
        actorId: ownerUserId,
        actorType: ActorType.USER,
        ...pod,
      });
    }

    this.events.emit('orders.status_changed', {
      orderId,
      storeId: order.storeId,
      fromStatus: order.status,
      toStatus: status,
      moduleType: order.moduleType as ModuleType,
    });
    if (status === ModuleOrderStatus.READY) {
      this.events.emit('orders.ready', { orderId, storeId: order.storeId });
    }

    return this.getMine(ownerUserId, orderId);
  }

  /** Alias used by legacy vendor dashboard: POST /merchant/orders/:id/ready */
  public async markReady(ownerUserId: string, orderId: string) {
    return this.updateStatus(ownerUserId, orderId, ModuleOrderStatus.READY);
  }

  private async ownedStoreIds(
    ownerUserId: string,
    storeId?: string,
  ): Promise<readonly string[]> {
    const stores = await this.prisma.store.findMany({
      where: {
        deletedAt: null,
        merchant: { ownerUserId, deletedAt: null },
        ...(storeId ? { id: storeId } : {}),
      },
      select: { id: true },
    });
    if (storeId && stores.length === 0) {
      throw new ForbiddenException('Store is not owned by this merchant');
    }
    if (stores.length === 0) {
      throw new NotFoundException('No stores found for this merchant');
    }
    return stores.map((s) => s.id);
  }

  private async requireOwnedOrder(ownerUserId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: {
        store: { include: { merchant: { select: { ownerUserId: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.store.merchant.ownerUserId !== ownerUserId) {
      throw new ForbiddenException('Order does not belong to your merchant');
    }
    return order;
  }
}
