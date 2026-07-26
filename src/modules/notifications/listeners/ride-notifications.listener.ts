import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RideStatus } from '@prisma/client';
import { NotificationsService } from '../use-cases/notifications.service';
import { NotificationType } from '../domain/notification.types';

interface RidePaymentEventPayload {
  readonly rideId: string;
  readonly paymentId: string;
  readonly customerId: string;
}

interface RideStatusChangedPayload {
  readonly rideId: string;
  readonly customerId: string;
  readonly fromStatus: RideStatus;
  readonly toStatus: RideStatus;
  readonly reason?: string;
}

const STATUS_COPY: Partial<Record<RideStatus, { title: string; body: string }>> = {
  [RideStatus.SEARCHING]: {
    title: 'Finding you a rider',
    body: 'Payment confirmed — we are matching you with a nearby rider.',
  },
  [RideStatus.ASSIGNED]: {
    title: 'Rider assigned',
    body: 'A rider has accepted your ride and is on the way.',
  },
  [RideStatus.ARRIVING]: {
    title: 'Rider is arriving',
    body: 'Your rider is almost at the pickup point.',
  },
  [RideStatus.IN_PROGRESS]: {
    title: 'Ride started',
    body: 'Your trip is now in progress.',
  },
  [RideStatus.COMPLETED]: {
    title: 'Ride completed',
    body: 'Your ride has been completed. Rate your trip.',
  },
  [RideStatus.CANCELLED]: {
    title: 'Ride cancelled',
    body: 'Your ride was cancelled.',
  },
  [RideStatus.FAILED]: {
    title: 'Ride could not be completed',
    body: 'We could not complete your ride request.',
  },
};

/**
 * Thin in-app notification writer for rides. Never throws back into the
 * emitter — a failure to notify must not fail ride/payment processing.
 */
@Injectable()
export class RideNotificationsListener {
  private readonly logger = new Logger(RideNotificationsListener.name);

  public constructor(private readonly notifications: NotificationsService) {}

  @OnEvent('transport.ride.payment_confirmed')
  public async onPaymentConfirmed(event: RidePaymentEventPayload): Promise<void> {
    await this.safeCreate(event.customerId, {
      userId: event.customerId,
      type: NotificationType.RIDE_STATUS,
      title: 'Payment confirmed',
      body: 'Your ride payment was confirmed. Finding you a rider now.',
      rideId: event.rideId,
      data: { paymentId: event.paymentId },
    });
  }

  @OnEvent('transport.ride.payment_failed')
  public async onPaymentFailed(event: RidePaymentEventPayload): Promise<void> {
    await this.safeCreate(event.customerId, {
      userId: event.customerId,
      type: NotificationType.RIDE_STATUS,
      title: 'Ride payment failed',
      body: 'Your ride payment failed. You can retry from the app.',
      rideId: event.rideId,
      data: { paymentId: event.paymentId },
    });
  }

  @OnEvent('transport.ride.status_changed')
  @OnEvent('transport.RideStatusChanged')
  public async onStatusChanged(event: RideStatusChangedPayload): Promise<void> {
    const copy = STATUS_COPY[event.toStatus];
    if (!copy) return;
    const type =
      event.toStatus === RideStatus.COMPLETED
        ? NotificationType.RIDE_COMPLETED
        : NotificationType.RIDE_STATUS;
    await this.safeCreate(event.customerId, {
      userId: event.customerId,
      type,
      title: copy.title,
      body: copy.body,
      rideId: event.rideId,
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
        `Failed to write ride notification for ${customerId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
