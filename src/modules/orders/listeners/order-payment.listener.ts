import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ActorType,
  ModuleOrderStatus,
  PaymentStatus,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { PaymentEvent } from '../../payments/domain/payment';

@Injectable()
export class OrderPaymentListener {
  private readonly logger = new Logger(OrderPaymentListener.name);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @OnEvent('payments.PaymentCompleted')
  public async onPaymentCompleted(event: PaymentEvent): Promise<void> {
    const orderId = await this.resolveOrderId(event);
    if (!orderId) return;

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      this.logger.warn(
        `PaymentCompleted for missing order ${orderId} (${event.aggregateId})`,
      );
      return;
    }
    if (
      order.status === ModuleOrderStatus.PAID ||
      order.paymentStatus === PaymentStatus.SUCCESS
    ) {
      return;
    }

    // Food UX: the vendor may have already accepted the order before the
    // customer paid. Don't regress a workflow status (e.g. ACCEPTED) back
    // to PAID — only bump status forward when payment arrives first.
    const nextStatus =
      order.status === ModuleOrderStatus.PENDING_PAYMENT
        ? ModuleOrderStatus.PAID
        : order.status;

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: nextStatus,
          paymentStatus: PaymentStatus.SUCCESS,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: nextStatus,
          actorType: ActorType.SYSTEM,
          reason: `Payment ${event.aggregateId} completed`,
        },
      });
    });

    this.events.emit('orders.payment_confirmed', {
      orderId: order.id,
      paymentId: event.aggregateId,
      customerId: order.customerId,
    });
  }

  @OnEvent('payments.PaymentFailed')
  public async onPaymentFailed(event: PaymentEvent): Promise<void> {
    const orderId = await this.resolveOrderId(event);
    if (!orderId) return;

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.paymentStatus === PaymentStatus.SUCCESS) return;

    await this.prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: PaymentStatus.FAILED },
    });

    this.events.emit('orders.payment_failed', {
      orderId: order.id,
      paymentId: event.aggregateId,
      customerId: order.customerId,
    });
  }

  private async resolveOrderId(event: PaymentEvent): Promise<string | null> {
    const fromPayload = event.payload.orderId;
    if (typeof fromPayload === 'string' && fromPayload.length > 0) {
      return fromPayload;
    }
    const payment = await this.prisma.payment.findUnique({
      where: { id: event.aggregateId },
      select: { orderId: true, purpose: true },
    });
    if (!payment || payment.purpose !== 'ORDER') return null;
    return payment.orderId;
  }
}
