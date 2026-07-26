import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RideStatus } from '@prisma/client';
import { RealtimeService } from '../../../platform/realtime/realtime.service';

interface RideStatusChangedPayload {
  readonly rideId: string;
  readonly customerId?: string;
  readonly fromStatus: RideStatus;
  readonly toStatus: RideStatus;
  readonly riderId?: string | null;
  readonly reason?: string;
}

interface RiderAssignedPayload {
  readonly rideId: string;
  readonly riderId: string;
  readonly customerId: string;
  readonly assignedAt: string;
  readonly auto?: boolean;
}

interface RidePaymentPayload {
  readonly rideId: string;
  readonly paymentId: string;
  readonly customerId: string;
}

const STATUS_SOCKET: Partial<Record<RideStatus, string>> = {
  [RideStatus.ASSIGNED]: 'rideAccepted',
  [RideStatus.ARRIVING]: 'rideArrived',
  [RideStatus.IN_PROGRESS]: 'rideStarted',
  [RideStatus.COMPLETED]: 'rideCompleted',
  [RideStatus.CANCELLED]: 'rideCancelled',
  [RideStatus.FAILED]: 'rideCancelled',
};

/**
 * Bridges Nest domain events → platform RealtimeService rooms.
 * REST remains source of truth; sockets are progressive enhancement (Uidocs 13/15).
 */
@Injectable()
export class RideRealtimeListener {
  private readonly logger = new Logger(RideRealtimeListener.name);

  public constructor(private readonly realtime: RealtimeService) {}

  @OnEvent('transport.ride.status_changed')
  @OnEvent('transport.RideStatusChanged')
  public async onStatusChanged(event: RideStatusChangedPayload): Promise<void> {
    await this.safePublish(`ride:${event.rideId}`, {
      type: 'rideStatusChanged',
      payload: event,
    });
    const alias = STATUS_SOCKET[event.toStatus];
    if (alias) {
      await this.safePublish(`ride:${event.rideId}`, {
        type: alias,
        payload: event,
      });
    }
    if (event.customerId) {
      await this.safePublishToUser(event.customerId, {
        type: 'rideStatusChanged',
        payload: event,
      });
    }
  }

  @OnEvent('transport.RiderAssigned')
  public async onAssigned(event: RiderAssignedPayload): Promise<void> {
    await this.safePublish(`ride:${event.rideId}`, {
      type: 'rideAccepted',
      payload: event,
    });
    await this.safePublishToUser(event.customerId, {
      type: 'rideAccepted',
      payload: event,
    });
  }

  @OnEvent('transport.ride.payment_confirmed')
  public async onPaymentConfirmed(event: RidePaymentPayload): Promise<void> {
    await this.safePublish(`ride:${event.rideId}`, {
      type: 'paymentConfirmed',
      payload: event,
    });
  }

  @OnEvent('transport.ride.payment_failed')
  public async onPaymentFailed(event: RidePaymentPayload): Promise<void> {
    await this.safePublish(`ride:${event.rideId}`, {
      type: 'paymentFailed',
      payload: event,
    });
  }

  private async safePublish(
    room: string,
    input: { readonly type: string; readonly payload: unknown },
  ): Promise<void> {
    if (!this.realtime.isEnabled) return;
    try {
      await this.realtime.publishToRoom(room, {
        type: input.type,
        payload: input.payload,
      });
    } catch (error) {
      this.logger.warn(
        `Realtime publish to ${room} failed: ${(error as Error).message}`,
      );
    }
  }

  private async safePublishToUser(
    userId: string,
    input: { readonly type: string; readonly payload: unknown },
  ): Promise<void> {
    if (!this.realtime.isEnabled) return;
    try {
      await this.realtime.publishToUser(userId, {
        type: input.type,
        payload: input.payload,
      });
    } catch (error) {
      this.logger.warn(
        `Realtime publish to user ${userId} failed: ${(error as Error).message}`,
      );
    }
  }
}
