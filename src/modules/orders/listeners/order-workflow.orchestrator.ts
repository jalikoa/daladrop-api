import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ModuleOrderStatus, ModuleType } from '@prisma/client';
import { Counter, Histogram } from 'prom-client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PrismaOutboxWriter } from '../../../infrastructure/database/outbox/prisma-outbox.writer';
import { RealtimeService } from '../../../platform/realtime/realtime.service';
import { NotificationsService } from '../../notifications/use-cases/notifications.service';
import {
  NotificationType,
  type NotificationTypeValue,
} from '../../notifications/domain/notification.types';

interface OrdersPlacedPayload {
  readonly orderIds: readonly string[];
  readonly customerId: string;
  readonly moduleType: ModuleType;
}

interface OrderStatusChangedPayload {
  readonly orderId: string;
  readonly storeId?: string;
  readonly fromStatus: ModuleOrderStatus;
  readonly toStatus: ModuleOrderStatus;
  readonly moduleType?: ModuleType;
}

interface OrderPaymentPayload {
  readonly orderId: string;
  readonly paymentId: string;
  readonly customerId: string;
}

const orderWorkflowCounter = new Counter({
  name: 'daladrop_order_workflow_events_total',
  help: 'Order workflow orchestration events',
  labelNames: ['event'] as const,
  registers: [],
});

const orderWorkflowLatency = new Histogram({
  name: 'daladrop_order_workflow_duration_seconds',
  help: 'Order workflow fan-out duration',
  labelNames: ['event'] as const,
  registers: [],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
});

/**
 * Event-driven order orchestration. Controllers/services emit domain events;
 * this listener fans out outbox integration events, realtime, and notifications.
 */
@Injectable()
export class OrderWorkflowOrchestrator {
  private readonly logger = new Logger(OrderWorkflowOrchestrator.name);
  private readonly outbox: PrismaOutboxWriter;
  private metricsRegistered = false;

  public constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {
    this.outbox = new PrismaOutboxWriter(this.prisma);
  }

  @OnEvent('orders.placed')
  public async onPlaced(event: OrdersPlacedPayload): Promise<void> {
    const end = this.startTimer('OrderCreated');
    try {
      for (const orderId of event.orderIds) {
        await this.appendOutbox('OrderCreated', orderId, {
          orderId,
          customerId: event.customerId,
          moduleType: event.moduleType,
        });
        await this.safeRealtime(`order:${orderId}`, 'orderCreated', {
          orderId,
          customerId: event.customerId,
          moduleType: event.moduleType,
        });
        await this.safeRealtime(`user:${event.customerId}`, 'orderCreated', {
          orderId,
        });
      }
      await this.notify(
        event.customerId,
        event.orderIds[0] ?? null,
        'Order placed',
        `Your ${event.moduleType.toLowerCase()} order was placed successfully.`,
        NotificationType.ORDER_STATUS,
      );
      this.inc('OrderCreated');
    } finally {
      end();
    }
  }

  @OnEvent('orders.status_changed')
  public async onStatusChanged(
    event: OrderStatusChangedPayload,
  ): Promise<void> {
    const end = this.startTimer('OrderStatusChanged');
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: {
          customerId: true,
          storeId: true,
          store: {
            select: {
              merchant: { select: { ownerUserId: true } },
            },
          },
        },
      });
      await this.appendOutbox('OrderStatusChanged', event.orderId, {
        ...event,
      });
      await this.safeRealtime(`order:${event.orderId}`, 'orderStatusChanged', event);
      if (order?.customerId) {
        await this.safeRealtime(
          `user:${order.customerId}`,
          'orderStatusChanged',
          event,
        );
        await this.notify(
          order.customerId,
          event.orderId,
          'Order updated',
          `Order status is now ${event.toStatus}.`,
          NotificationType.ORDER_STATUS,
        );
      }
      const merchantOwnerId = order?.store?.merchant?.ownerUserId;
      if (merchantOwnerId) {
        await this.safeRealtime(
          `user:${merchantOwnerId}`,
          'orderStatusChanged',
          event,
        );
        await this.notify(
          merchantOwnerId,
          event.orderId,
          'Merchant order update',
          `Order ${event.orderId.slice(0, 8)} is now ${event.toStatus}.`,
          NotificationType.ORDER_STATUS,
        );
      }
      this.inc('OrderStatusChanged');
    } finally {
      end();
    }
  }

  @OnEvent('orders.payment_confirmed')
  public async onPaymentConfirmed(event: OrderPaymentPayload): Promise<void> {
    await this.appendOutbox('PaymentCompleted', event.orderId, { ...event });
    await this.safeRealtime(`order:${event.orderId}`, 'paymentConfirmed', event);
    await this.notify(
      event.customerId,
      event.orderId,
      'Payment confirmed',
      'Your order payment was received.',
      NotificationType.ORDER_STATUS,
    );
    this.inc('PaymentCompleted');
  }

  @OnEvent('orders.payment_failed')
  public async onPaymentFailed(event: OrderPaymentPayload): Promise<void> {
    await this.appendOutbox('PaymentFailed', event.orderId, { ...event });
    await this.safeRealtime(`order:${event.orderId}`, 'paymentFailed', event);
    await this.notify(
      event.customerId,
      event.orderId,
      'Payment failed',
      'Order payment failed. You can retry from the app.',
      NotificationType.ORDER_STATUS,
    );
    this.inc('PaymentFailed');
  }

  private async appendOutbox(
    eventName: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.outbox.append({
        eventId: `${eventName}-${aggregateId}-${Date.now()}`,
        aggregateId,
        eventName,
        payload,
      });
    } catch (error) {
      this.logger.warn(`Outbox append failed: ${(error as Error).message}`);
    }
  }

  private async notify(
    userId: string,
    orderId: string | null,
    title: string,
    body: string,
    type: NotificationTypeValue,
  ): Promise<void> {
    try {
      // createInApp already fans out push — do not double-send.
      await this.notifications.createInApp({
        userId,
        type,
        title,
        body,
        ...(orderId ? { orderId } : {}),
      });
    } catch (error) {
      this.logger.warn(`Notify failed: ${(error as Error).message}`);
    }
  }

  private async safeRealtime(
    room: string,
    type: string,
    payload: unknown,
  ): Promise<void> {
    if (!this.realtime.isEnabled) return;
    try {
      if (room.startsWith('user:')) {
        await this.realtime.publishToUser(room.slice(5), { type, payload });
      } else {
        await this.realtime.publishToRoom(room, { type, payload });
      }
    } catch (error) {
      this.logger.debug(`Realtime skip: ${(error as Error).message}`);
    }
  }

  private ensureMetrics(): void {
    if (this.metricsRegistered) return;
    try {
      // Register lazily so unit tests without a global registry still work.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { register } = require('prom-client') as typeof import('prom-client');
      register.registerMetric(orderWorkflowCounter);
      register.registerMetric(orderWorkflowLatency);
    } catch {
      /* ignore */
    }
    this.metricsRegistered = true;
  }

  private inc(event: string): void {
    try {
      this.ensureMetrics();
      orderWorkflowCounter.inc({ event });
    } catch {
      /* ignore */
    }
  }

  private startTimer(event: string): () => void {
    const started = process.hrtime.bigint();
    return () => {
      try {
        this.ensureMetrics();
        const seconds = Number(process.hrtime.bigint() - started) / 1e9;
        orderWorkflowLatency.observe({ event }, seconds);
      } catch {
        /* ignore */
      }
    };
  }
}
