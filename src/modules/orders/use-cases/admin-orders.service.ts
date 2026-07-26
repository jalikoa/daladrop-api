import {
  BadRequestException,
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
import type {
  AdminOrderStatusDto,
  AdminOrdersQueryDto,
} from '../dto/orders.dto';

@Injectable()
export class AdminOrdersService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  public async list(query: AdminOrdersQueryDto) {
    const limit = query.limit ?? 50;
    const moduleType = query.moduleType
      ? (query.moduleType.toUpperCase() as ModuleType)
      : undefined;

    const orders = await this.prisma.order.findMany({
      where: {
        deletedAt: null,
        ...(moduleType ? { moduleType } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.storeId ? { storeId: query.storeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        store: { select: { id: true, name: true, storeType: true } },
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });

    return {
      items: orders.map((order) => ({
        id: order.id,
        moduleType: order.moduleType,
        status: order.status,
        paymentStatus: order.paymentStatus,
        customerId: order.customerId,
        customer: order.customer,
        storeId: order.storeId,
        store: order.store,
        subtotal: Number(order.subtotalAmount),
        deliveryFee: Number(order.deliveryFeeAmount),
        serviceFee: Number(order.serviceFeeAmount),
        total: Number(order.totalAmount),
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
      })),
    };
  }

  public async getById(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        store: true,
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return {
      id: order.id,
      moduleType: order.moduleType,
      status: order.status,
      paymentStatus: order.paymentStatus,
      customer: order.customer,
      store: {
        id: order.store.id,
        name: order.store.name,
        storeType: order.store.storeType,
        phone: order.store.phone,
      },
      subtotal: Number(order.subtotalAmount),
      deliveryFee: Number(order.deliveryFeeAmount),
      serviceFee: Number(order.serviceFeeAmount),
      total: Number(order.totalAmount),
      currency: order.currency,
      riderPay: Number(order.riderPayAmount),
      platformCommission: Number(order.platformCommissionAmount),
      distanceKm:
        order.distanceKm != null ? Number(order.distanceKm) : null,
      deliveryPricingRuleId: order.deliveryPricingRuleId,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.nameSnapshot,
        unitPrice: Number(item.unitPriceAmount),
        quantity: item.quantity,
        lineTotal: Number(item.lineTotalAmount),
        productId: item.productId,
        menuItemId: item.menuItemId,
      })),
      statusHistory: order.statusHistory.map((h) => ({
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        actorType: h.actorType,
        actorId: h.actorId,
        reason: h.reason,
        createdAt: h.createdAt.toISOString(),
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  public async updateStatus(
    orderId: string,
    actorId: string,
    body: AdminOrderStatusDto,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (
      body.status === ModuleOrderStatus.ACCEPTED &&
      order.status !== ModuleOrderStatus.PENDING_PAYMENT &&
      order.status !== ModuleOrderStatus.PAID
    ) {
      throw new BadRequestException(
        `Cannot accept order in status ${order.status}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: body.status,
          updatedBy: actorId,
          ...(body.status === ModuleOrderStatus.ACCEPTED
            ? { acceptedAt: new Date() }
            : {}),
          ...(body.status === ModuleOrderStatus.CANCELLED
            ? {
                cancelledAt: new Date(),
                cancelReason: body.reason ?? 'Cancelled by admin',
              }
            : {}),
          ...(body.status === ModuleOrderStatus.DELIVERED
            ? { deliveredAt: new Date() }
            : {}),
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: body.status,
          actorType: ActorType.ADMIN,
          actorId,
          reason: body.reason ?? `Admin set status to ${body.status}`,
        },
      });
    });

    if (
      body.status === ModuleOrderStatus.ACCEPTED &&
      order.moduleType === ModuleType.FOOD
    ) {
      this.events.emit('foodOrderPaymentRequested', {
        orderId,
        customerId: order.customerId,
        storeId: order.storeId,
        totalAmount: order.totalAmount.toString(),
        currency: order.currency,
      });
    }

    this.events.emit('orders.status_changed', {
      orderId,
      fromStatus: order.status,
      toStatus: body.status,
      actorId,
    });

    return this.getById(orderId);
  }
}
