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
  PaymentStatus,
  ReviewTargetType,
  StoreType,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import type {
  PayOrderDto,
  RateOrderDto,
  UpdateOrderStatusDto,
} from '../dto/orders.dto';
import { MultiCheckoutService } from './multi-checkout.service';

const CUSTOMER_CANCELLABLE = new Set<ModuleOrderStatus>([
  ModuleOrderStatus.PENDING_PAYMENT,
  ModuleOrderStatus.PAID,
  ModuleOrderStatus.ACCEPTED,
]);

@Injectable()
export class ModuleOrdersService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly checkout: MultiCheckoutService,
    private readonly events: EventEmitter2,
  ) {}

  public async getById(
    moduleType: ModuleType,
    orderId: string,
    actor: AuthPrincipalView,
  ) {
    const order = await this.loadOrder(moduleType, orderId);
    this.assertCustomerOrAdmin(order.customerId, actor);
    return this.toCustomerView(order);
  }

  /** Legacy `/orders/:id` — resolve module from the row. */
  public async getByIdAnyModule(orderId: string, actor: AuthPrincipalView) {
    const order = await this.loadOrderAny(orderId);
    this.assertCustomerOrAdmin(order.customerId, actor);
    return this.toCustomerView(order);
  }

  public async updateStatusAnyModule(
    orderId: string,
    actor: AuthPrincipalView,
    body: UpdateOrderStatusDto,
  ) {
    const order = await this.loadOrderAny(orderId);
    return this.updateStatus(order.moduleType, orderId, actor, body);
  }

  public async pay(
    moduleType: ModuleType,
    orderId: string,
    actor: AuthPrincipalView,
    body: PayOrderDto,
  ) {
    const order = await this.loadOrder(moduleType, orderId);
    this.assertCustomerOrAdmin(order.customerId, actor);

    const phone = body.mpesaPhone ?? body.phone;
    if (!phone) {
      throw new BadRequestException('mpesaPhone is required');
    }

    const result = await this.checkout.initiateOrderPayment(
      orderId,
      order.customerId,
      phone,
    );
    const view = await this.getById(moduleType, orderId, actor);
    return {
      success: true as const,
      orderId,
      paymentId: result.paymentId,
      mpesa: { initiated: result.initiated },
      checkoutRequestId: result.checkoutRequestId,
      ...view,
      paymentStatus: result.initiated
        ? PaymentStatus.PROCESSING
        : view.paymentStatus,
    };
  }

  public async updateStatus(
    moduleType: ModuleType,
    orderId: string,
    actor: AuthPrincipalView,
    body: UpdateOrderStatusDto,
  ) {
    const order = await this.loadOrder(moduleType, orderId);
    this.assertCustomerOrAdmin(order.customerId, actor);

    if (body.status !== ModuleOrderStatus.CANCELLED) {
      throw new BadRequestException(
        'Customers may only set status to CANCELLED on this endpoint',
      );
    }
    if (!CUSTOMER_CANCELLABLE.has(order.status)) {
      throw new BadRequestException(
        `Cannot cancel order in status ${order.status}`,
      );
    }
    if (order.paymentStatus === PaymentStatus.SUCCESS) {
      throw new BadRequestException(
        'Paid orders cannot be cancelled by the customer here; contact support',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.order.update({
        where: { id: orderId },
        data: {
          status: ModuleOrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: body.reason ?? 'Cancelled by customer',
          updatedBy: actor.id,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: ModuleOrderStatus.CANCELLED,
          actorType: ActorType.USER,
          actorId: actor.id,
          reason: body.reason ?? 'Cancelled by customer',
        },
      });
      return next;
    });

    this.events.emit('orders.cancelled', {
      orderId,
      customerId: order.customerId,
      moduleType,
    });

    return this.getById(moduleType, orderId, actor);
  }

  public async rate(
    moduleType: ModuleType,
    orderId: string,
    actor: AuthPrincipalView,
    body: RateOrderDto,
  ) {
    const order = await this.loadOrder(moduleType, orderId);
    this.assertCustomerOrAdmin(order.customerId, actor);
    if (order.status !== ModuleOrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be rated');
    }

    const score =
      body.score ??
      body.restaurantScore ??
      body.marketScore ??
      body.storeScore;
    if (score == null) {
      throw new BadRequestException(
        'score (or restaurantScore/marketScore/storeScore) is required',
      );
    }

    const existing = await this.prisma.review.findFirst({
      where: {
        orderId,
        authorId: actor.id,
        targetType: ReviewTargetType.STORE,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new BadRequestException('Order already rated');
    }

    const review = await this.prisma.review.create({
      data: {
        authorId: actor.id,
        targetType: ReviewTargetType.STORE,
        storeId: order.storeId,
        orderId,
        score,
        comment: body.comment ?? null,
        tags: body.tags ?? [],
      },
    });

    await this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: order.status,
        actorType: ActorType.USER,
        actorId: actor.id,
        reason: `Rated store score=${score}`,
      },
    });

    let riderReviewId: string | null = null;
    if (body.riderScore != null && order.riderId) {
      const existingRiderReview = await this.prisma.review.findFirst({
        where: {
          orderId,
          authorId: actor.id,
          targetType: ReviewTargetType.RIDER,
          deletedAt: null,
        },
      });
      if (!existingRiderReview) {
        const riderReview = await this.prisma.review.create({
          data: {
            authorId: actor.id,
            targetType: ReviewTargetType.RIDER,
            riderId: order.riderId,
            orderId,
            score: body.riderScore,
            comment: body.comment ?? null,
            tags: body.tags ?? [],
          },
        });
        riderReviewId = riderReview.id;
        await this.updateRiderRatingAggregate(order.riderId);
      }
    }

    return {
      success: true as const,
      reviewId: review.id,
      score: review.score,
      comment: review.comment,
      ...(riderReviewId ? { riderReviewId } : {}),
    };
  }

  private async updateRiderRatingAggregate(riderId: string): Promise<void> {
    const aggregate = await this.prisma.review.aggregate({
      where: { riderId, targetType: ReviewTargetType.RIDER, deletedAt: null },
      _avg: { score: true },
      _count: { score: true },
    });
    await this.prisma.rider.update({
      where: { id: riderId },
      data: {
        ratingAvg: aggregate._avg.score ?? 0,
        reviewCount: aggregate._count.score ?? 0,
      },
    });
  }

  public async listCustomerHistory(
    moduleType: ModuleType,
    uid: string,
    actor: AuthPrincipalView,
    page = 1,
    limit = 20,
  ) {
    this.assertCustomerOrAdmin(uid, actor);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const where = {
      customerId: uid,
      moduleType,
      deletedAt: null,
      customerHiddenAt: null,
    };
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        include: this.orderInclude(),
      }),
    ]);
    return {
      success: true as const,
      items: orders.map((order) => this.toCustomerView(order)),
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: safePage * safeLimit < total,
    };
  }

  public async hideCustomerHistory(
    moduleType: ModuleType,
    uid: string,
    actor: AuthPrincipalView,
  ) {
    this.assertCustomerOrAdmin(uid, actor);
    await this.prisma.order.updateMany({
      where: {
        customerId: uid,
        moduleType,
        deletedAt: null,
        customerHiddenAt: null,
      },
      data: { customerHiddenAt: new Date() },
    });
    return { success: true as const };
  }

  private async loadOrder(moduleType: ModuleType, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, moduleType, deletedAt: null },
      include: this.orderInclude(),
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async loadOrderAny(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: this.orderInclude(),
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private orderInclude() {
    return {
      items: true,
      store: {
        select: {
          id: true,
          name: true,
          storeType: true,
          imageUrl: true,
          phone: true,
          address: true,
          city: true,
          latitude: true,
          longitude: true,
        },
      },
    } as const;
  }

  private assertCustomerOrAdmin(
    customerId: string,
    actor: AuthPrincipalView,
  ): void {
    const isAdmin = actor.roles.some((role) =>
      ['ADMIN', 'SUPPORT', 'FINANCE'].includes(role),
    );
    if (actor.id !== customerId && !isAdmin) {
      throw new ForbiddenException('Cannot access another user order');
    }
  }

  private mapCustomerStatus(status: ModuleOrderStatus): string {
    if (status === ModuleOrderStatus.PENDING_PAYMENT) return 'PENDING';
    return status;
  }

  private vendorNestKey(storeType: StoreType): string {
    switch (storeType) {
      case StoreType.RESTAURANT:
        return 'restaurant';
      case StoreType.MARKET:
        return 'market';
      default:
        return 'store';
    }
  }

  private toCustomerView(
    order: Awaited<ReturnType<ModuleOrdersService['loadOrder']>>,
  ) {
    const vendorKey = this.vendorNestKey(order.store.storeType);
    const vendor = {
      id: order.store.id,
      name: order.store.name,
      imageUrl: order.store.imageUrl,
      phone: order.store.phone,
      address: order.store.address,
      city: order.store.city,
      latitude: order.store.latitude != null ? Number(order.store.latitude) : null,
      longitude:
        order.store.longitude != null ? Number(order.store.longitude) : null,
    };
    return {
      id: order.id,
      moduleType: order.moduleType,
      status: this.mapCustomerStatus(order.status),
      statusRaw: order.status,
      paymentStatus: order.paymentStatus,
      customerId: order.customerId,
      storeId: order.storeId,
      deliveryAddress: order.deliveryAddress,
      deliveryLatitude:
        order.deliveryLatitude != null
          ? Number(order.deliveryLatitude)
          : null,
      deliveryLongitude:
        order.deliveryLongitude != null
          ? Number(order.deliveryLongitude)
          : null,
      // Alias fields for clients that expect deliveryLat/deliveryLng.
      deliveryLat:
        order.deliveryLatitude != null
          ? Number(order.deliveryLatitude)
          : null,
      deliveryLng:
        order.deliveryLongitude != null
          ? Number(order.deliveryLongitude)
          : null,
      notes: order.notes,
      subtotal: Number(order.subtotalAmount),
      deliveryFee: Number(order.deliveryFeeAmount),
      serviceFee: Number(order.serviceFeeAmount),
      total: Number(order.totalAmount),
      currency: order.currency,
      distanceKm:
        order.distanceKm != null ? Number(order.distanceKm) : null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        menuItemId: item.menuItemId,
        name: item.nameSnapshot,
        unitPrice: Number(item.unitPriceAmount),
        quantity: item.quantity,
        lineTotal: Number(item.lineTotalAmount),
        notes: item.notes,
        modifierOptionIds: item.modifierOptionIds,
        imageUrl: item.imageUrl,
      })),
      [vendorKey]: vendor,
      store: vendor,
    };
  }
}
