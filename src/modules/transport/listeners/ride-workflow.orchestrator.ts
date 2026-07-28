import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { RideStatus } from '@prisma/client';
import { Counter, Histogram } from 'prom-client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PrismaOutboxWriter } from '../../../infrastructure/database/outbox/prisma-outbox.writer';
import { RealtimeService } from '../../../platform/realtime/realtime.service';
import { EmailService } from '../../../platform/messaging/email/email.service';
import { SmsService } from '../../../platform/messaging/sms/sms.service';
import { NotificationsService } from '../../notifications/use-cases/notifications.service';
import { NotificationType } from '../../notifications/domain/notification.types';
import { PushDeliveryService } from '../../notifications/use-cases/push-delivery.service';

interface RideStatusPayload {
  readonly rideId: string;
  readonly customerId?: string;
  readonly riderId?: string | null;
  readonly fromStatus?: RideStatus;
  readonly toStatus: RideStatus;
  readonly reason?: string;
}

interface RiderAssignedPayload {
  readonly rideId: string;
  readonly riderId: string;
  readonly customerId: string;
  readonly auto?: boolean;
}

interface RidePaymentPayload {
  readonly rideId: string;
  readonly paymentId: string;
  readonly customerId: string;
}

const rideWorkflowCounter = new Counter({
  name: 'daladrop_ride_workflow_events_total',
  help: 'Ride workflow orchestration events',
  labelNames: ['event'] as const,
  registers: [],
});

const rideWorkflowLatency = new Histogram({
  name: 'daladrop_ride_workflow_duration_seconds',
  help: 'Ride workflow fan-out duration',
  labelNames: ['event'] as const,
  registers: [],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
});

const CUSTOMER_COPY: Partial<
  Record<RideStatus, { title: string; body: string; socket: string }>
> = {
  [RideStatus.PENDING_PAYMENT]: {
    title: 'Complete payment',
    body: 'Your ride request is waiting for payment.',
    socket: 'ridePaymentRequested',
  },
  [RideStatus.SEARCHING]: {
    title: 'Finding a rider',
    body: 'We are searching for a nearby rider.',
    socket: 'nearbyRidersUpdate',
  },
  [RideStatus.ASSIGNED]: {
    title: 'Rider assigned',
    body: 'A rider accepted your request and is on the way.',
    socket: 'rideAccepted',
  },
  [RideStatus.REJECTED]: {
    title: 'Rider unavailable',
    body: 'The assigned rider declined. Searching again…',
    socket: 'rideStatusChanged',
  },
  [RideStatus.ARRIVING]: {
    title: 'Rider arriving',
    body: 'Your rider has arrived at the pickup point.',
    socket: 'rideArrived',
  },
  [RideStatus.IN_PROGRESS]: {
    title: 'Trip started',
    body: 'Your ride is in progress.',
    socket: 'rideStarted',
  },
  [RideStatus.COMPLETED]: {
    title: 'Trip completed',
    body: 'Your ride is complete. Please rate your trip.',
    socket: 'rideCompleted',
  },
  [RideStatus.CANCELLED]: {
    title: 'Ride cancelled',
    body: 'Your ride was cancelled.',
    socket: 'rideCancelled',
  },
  [RideStatus.FAILED]: {
    title: 'Ride failed',
    body: 'We could not complete your ride.',
    socket: 'rideCancelled',
  },
};

/**
 * Central ride workflow orchestrator. Controllers/services only emit domain
 * events; this listener fans out realtime, in-app/push/SMS/email, and outbox
 * integration events. Never invoked from controllers directly.
 */
@Injectable()
export class RideWorkflowOrchestrator {
  private readonly logger = new Logger(RideWorkflowOrchestrator.name);
  private readonly outbox: PrismaOutboxWriter;
  private metricsRegistered = false;

  public constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
    private readonly push: PushDeliveryService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
    private readonly config: ConfigService,
  ) {
    this.outbox = new PrismaOutboxWriter(this.prisma);
  }

  @OnEvent('transport.ride.created')
  public async onCreated(event: {
    readonly rideId: string;
    readonly customerId: string;
  }): Promise<void> {
    await this.fanOut({
      rideId: event.rideId,
      customerId: event.customerId,
      toStatus: RideStatus.PENDING_PAYMENT,
      eventName: 'RideRequested',
      title: 'Ride requested',
      body: 'Your ride request was created. Complete payment to continue.',
      socket: 'ridePaymentRequested',
    });
  }

  @OnEvent('transport.ride.payment_confirmed')
  public async onPaymentConfirmed(event: RidePaymentPayload): Promise<void> {
    await this.fanOut({
      rideId: event.rideId,
      customerId: event.customerId,
      toStatus: RideStatus.SEARCHING,
      eventName: 'PaymentCompleted',
      title: 'Payment confirmed',
      body: 'Payment received. Finding you a rider.',
      socket: 'paymentConfirmed',
    });
  }

  @OnEvent('transport.ride.payment_failed')
  public async onPaymentFailed(event: RidePaymentPayload): Promise<void> {
    await this.fanOut({
      rideId: event.rideId,
      customerId: event.customerId,
      toStatus: RideStatus.FAILED,
      eventName: 'PaymentFailed',
      title: 'Payment failed',
      body: 'Ride payment failed. You can retry from the app.',
      socket: 'paymentFailed',
    });
  }

  @OnEvent('transport.ride.refund_processed')
  public async onRefundProcessed(event: RidePaymentPayload & {
    readonly refundId?: unknown;
    readonly refundAmount?: unknown;
  }): Promise<void> {
    await this.fanOut({
      rideId: event.rideId,
      customerId: event.customerId,
      toStatus: RideStatus.CANCELLED,
      eventName: 'RefundProcessed',
      title: 'Refund processed',
      body: 'Your ride payment refund has been processed.',
      socket: 'refundProcessed',
    });
  }

  @OnEvent('transport.RiderAssigned')
  public async onAssigned(event: RiderAssignedPayload): Promise<void> {
    await this.fanOut({
      rideId: event.rideId,
      customerId: event.customerId,
      riderId: event.riderId,
      toStatus: RideStatus.ASSIGNED,
      eventName: 'RideAssigned',
      title: 'Rider assigned',
      body: 'A rider accepted your request.',
      socket: 'rideAccepted',
      notifyRider: true,
      riderTitle: 'New ride assigned',
      riderBody: 'You have a new ride. Open the rider app to navigate.',
    });
  }

  @OnEvent('transport.ride.status_changed')
  @OnEvent('transport.RideStatusChanged')
  public async onStatusChanged(event: RideStatusPayload): Promise<void> {
    const copy = CUSTOMER_COPY[event.toStatus];
    if (!copy) return;
    const eventName =
      event.toStatus === RideStatus.COMPLETED
        ? 'RideCompleted'
        : event.toStatus === RideStatus.CANCELLED
          ? 'RideCancelled'
          : event.toStatus === RideStatus.REJECTED
            ? 'RideRejected'
            : 'RideStatusChanged';

    await this.fanOut({
      rideId: event.rideId,
      customerId: event.customerId,
      riderId: event.riderId,
      toStatus: event.toStatus,
      eventName,
      title: copy.title,
      body: copy.body,
      socket: copy.socket,
      notifyRider: true,
      riderTitle: `Ride ${event.toStatus}`,
      riderBody: copy.body,
    });

    // Rejected → auto return to searching is handled by dispatch; emit searching cue.
    if (event.toStatus === RideStatus.REJECTED) {
      await this.safeRealtime(`ride:${event.rideId}`, 'noRidersFound', event);
    }
  }

  private async fanOut(input: {
    readonly rideId: string;
    readonly customerId?: string;
    readonly riderId?: string | null;
    readonly toStatus: RideStatus;
    readonly eventName: string;
    readonly title: string;
    readonly body: string;
    readonly socket: string;
    readonly notifyRider?: boolean;
    readonly riderTitle?: string;
    readonly riderBody?: string;
  }): Promise<void> {
    const started = process.hrtime.bigint();
    const ride = await this.prisma.ride.findUnique({
      where: { id: input.rideId },
      include: {
        customer: { select: { id: true, email: true, phoneE164: true, phone: true } },
        rider: { select: { id: true, userId: true } },
      },
    });
    const customerId = input.customerId ?? ride?.customerId;
    const riderUserId = ride?.rider?.userId;

    try {
      await this.outbox.append({
        eventId: `${input.eventName}-${input.rideId}-${Date.now()}`,
        aggregateId: input.rideId,
        eventName: input.eventName,
        payload: {
          rideId: input.rideId,
          customerId,
          riderId: input.riderId ?? ride?.riderId,
          status: input.toStatus,
        },
      });
    } catch (error) {
      this.logger.warn(`Outbox append failed: ${(error as Error).message}`);
    }

    await this.safeRealtime(`ride:${input.rideId}`, input.socket, {
      rideId: input.rideId,
      status: input.toStatus,
      customerId,
      riderId: input.riderId ?? ride?.riderId,
    });
    await this.safeRealtime(`ride:${input.rideId}`, 'rideStatusChanged', {
      rideId: input.rideId,
      status: input.toStatus,
    });
    if (customerId) {
      await this.safeRealtime(`user:${customerId}`, 'rideStatusChanged', {
        rideId: input.rideId,
        status: input.toStatus,
      });
    }

    if (customerId) {
      try {
        await this.notifications.createInApp({
          userId: customerId,
          type:
            input.toStatus === RideStatus.COMPLETED
              ? NotificationType.RIDE_COMPLETED
              : NotificationType.RIDE_STATUS,
          title: input.title,
          body: input.body,
          rideId: input.rideId,
          data: { status: input.toStatus, event: input.eventName },
        });
      } catch (error) {
        this.logger.warn(`In-app notify failed: ${(error as Error).message}`);
      }

      try {
        await this.push.sendToUser({
          userId: customerId,
          type: NotificationType.RIDE_STATUS,
          title: input.title,
          body: input.body,
          data: { rideId: input.rideId, status: String(input.toStatus) },
        });
      } catch {
        /* ignore */
      }

      const email = ride?.customer.email;
      if (email && process.env.RIDE_EMAIL_NOTIFICATIONS === 'true') {
        try {
          await this.email.send('smtp', {
            to: [email],
            from:
              this.config.get<string>('email.from') ??
              'noreply@daladrop.local',
            subject: input.title,
            text: input.body,
          });
        } catch (error) {
          this.logger.debug(`Email skip: ${(error as Error).message}`);
        }
      }
      const phone = ride?.customer.phoneE164 ?? ride?.customer.phone;
      if (phone && process.env.RIDE_SMS_NOTIFICATIONS === 'true') {
        try {
          await this.sms.send(
            this.config.get<string>('auth.smsProvider') ?? 'http-sms',
            { to: phone, body: `${input.title}: ${input.body}` },
          );
        } catch (error) {
          this.logger.debug(`SMS skip: ${(error as Error).message}`);
        }
      }
    }

    if (input.notifyRider && riderUserId) {
      try {
        await this.notifications.createInApp({
          userId: riderUserId,
          type: NotificationType.RIDE_STATUS,
          title: input.riderTitle ?? input.title,
          body: input.riderBody ?? input.body,
          rideId: input.rideId,
        });
        await this.safeRealtime(`user:${riderUserId}`, input.socket, {
          rideId: input.rideId,
          status: input.toStatus,
        });
      } catch (error) {
        this.logger.warn(`Rider notify failed: ${(error as Error).message}`);
      }
    }

    this.recordMetrics(input.eventName, started);
  }

  private recordMetrics(event: string, started: bigint): void {
    try {
      if (!this.metricsRegistered) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { register } = require('prom-client') as typeof import('prom-client');
        register.registerMetric(rideWorkflowCounter);
        register.registerMetric(rideWorkflowLatency);
        this.metricsRegistered = true;
      }
      rideWorkflowCounter.inc({ event });
      rideWorkflowLatency.observe(
        { event },
        Number(process.hrtime.bigint() - started) / 1e9,
      );
    } catch {
      /* ignore metrics failures */
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
}
