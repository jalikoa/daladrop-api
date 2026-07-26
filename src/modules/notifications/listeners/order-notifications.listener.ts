import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ModuleOrderStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { NotificationsService } from '../use-cases/notifications.service';
import { NotificationType } from '../domain/notification.types';

interface OrderPaymentEventPayload {
  readonly orderId: string;
  readonly paymentId: string;
  readonly customerId: string;
}

interface OrderStatusChangedPayload {
  readonly orderId: string;
  readonly fromStatus: ModuleOrderStatus;
  readonly toStatus: ModuleOrderStatus;
  readonly actorId?: string;
}

const STATUS_COPY: Partial<
  Record<ModuleOrderStatus, { title: string; body: string }>
> = {
  [ModuleOrderStatus.ACCEPTED]: {
    title: 'Order accepted',
    body: 'The merchant has accepted your order and is preparing it.',
  },
  [ModuleOrderStatus.PREPARING]: {
    title: 'Order in progress',
    body: 'Your order is being prepared.',
  },
  [ModuleOrderStatus.READY]: {
    title: 'Order ready',
    body: 'Your order is ready for pickup / dispatch.',
  },
  [ModuleOrderStatus.PICKED_UP]: {
    title: 'Order picked up',
    body: 'Your order has been picked up for delivery.',
  },
  [ModuleOrderStatus.ON_THE_WAY]: {
    title: 'Order on the way',
    body: 'Your order is on the way to you.',
  },
  [ModuleOrderStatus.DELIVERED]: {
    title: 'Order delivered',
    body: 'Your order has been delivered. Enjoy!',
  },
  [ModuleOrderStatus.CANCELLED]: {
    title: 'Order cancelled',
    body: 'Your order was cancelled.',
  },
};

/**
 * Thin in-app notification writer for module (food/market/etc) orders.
 * Never throws back into the emitter — a failure to notify must not fail
 * order/payment processing.
 */
@Injectable()
export class OrderNotificationsListener {
  private readonly logger = new Logger(OrderNotificationsListener.name);

  public constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('orders.payment_confirmed')
  public async onPaymentConfirmed(event: OrderPaymentEventPayload): Promise<void> {
    await this.safeCreate(event.customerId, {
      userId: event.customerId,
      type: NotificationType.FOOD_ORDER,
      title: 'Order payment confirmed',
      body: 'Your order payment was confirmed and sent to the merchant.',
      orderId: event.orderId,
      data: { paymentId: event.paymentId },
    });
  }

  @OnEvent('orders.payment_failed')
  public async onPaymentFailed(event: OrderPaymentEventPayload): Promise<void> {
    await this.safeCreate(event.customerId, {
      userId: event.customerId,
      type: NotificationType.FOOD_ORDER,
      title: 'Order payment failed',
      body: 'Your order payment failed. You can retry from the app.',
      orderId: event.orderId,
      data: { paymentId: event.paymentId },
    });
  }

  @OnEvent('orders.status_changed')
  public async onStatusChanged(event: OrderStatusChangedPayload): Promise<void> {
    const copy = STATUS_COPY[event.toStatus];
    if (!copy) return;
    const order = await this.prisma.order.findUnique({
      where: { id: event.orderId },
      select: { customerId: true },
    });
    if (!order) return;
    await this.safeCreate(order.customerId, {
      userId: order.customerId,
      type: NotificationType.FOOD_ORDER,
      title: copy.title,
      body: copy.body,
      orderId: event.orderId,
      data: { fromStatus: event.fromStatus, toStatus: event.toStatus },
    });
  }

  private async safeCreate(
    customerId: string | undefined,
    input: Parameters<NotificationsService['createInApp']>[0],
  ): Promise<void> {
    if (!customerId) return;
    try {
      await this.notifications.createInApp(input);
    } catch (error) {
      this.logger.error(
        `Failed to write order notification for ${customerId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
