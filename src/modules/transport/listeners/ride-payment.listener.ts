import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ActorType, PaymentStatus, RideStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { PaymentEvent } from '../../payments/domain/payment';
import { RideDispatchService } from '../use-cases/ride-dispatch.service';

/**
 * Reacts to durable/in-process payment domain events for rides.
 * Mirrors `EventBookingPaymentListener` / `OrderPaymentListener`: never
 * flips a ride to SEARCHING purely on STK initiation — only on confirmed
 * `PaymentCompleted`.
 */
@Injectable()
export class RidePaymentListener {
  private readonly logger = new Logger(RidePaymentListener.name);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly dispatch: RideDispatchService,
  ) {}

  @OnEvent('payments.PaymentCompleted')
  public async onPaymentCompleted(event: PaymentEvent): Promise<void> {
    const rideId = await this.resolveRideId(event);
    if (!rideId) return;

    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      this.logger.warn(
        `PaymentCompleted for missing ride ${rideId} (${event.aggregateId})`,
      );
      return;
    }
    if (ride.paymentStatus === PaymentStatus.SUCCESS) return;

    const nextStatus =
      ride.status === RideStatus.PENDING_PAYMENT
        ? RideStatus.SEARCHING
        : ride.status;

    await this.prisma.$transaction(async (tx) => {
      await tx.ride.update({
        where: { id: ride.id },
        data: {
          paymentStatus: PaymentStatus.SUCCESS,
          status: nextStatus,
        },
      });
      await tx.rideStatusHistory.create({
        data: {
          rideId: ride.id,
          fromStatus: ride.status,
          toStatus: nextStatus,
          actorType: ActorType.SYSTEM,
          reason: `Payment ${event.aggregateId} completed`,
        },
      });
    });

    this.events.emit('transport.ride.payment_confirmed', {
      rideId: ride.id,
      paymentId: event.aggregateId,
      customerId: ride.customerId,
    });

    if (nextStatus === RideStatus.SEARCHING) {
      try {
        await this.dispatch.autoAssignNearest(ride.id);
      } catch (error) {
        this.logger.warn(
          `Auto-assign failed for ride ${ride.id} after payment: ${String(error)}`,
        );
      }
    }
  }

  @OnEvent('payments.PaymentFailed')
  public async onPaymentFailed(event: PaymentEvent): Promise<void> {
    const rideId = await this.resolveRideId(event);
    if (!rideId) return;

    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.paymentStatus === PaymentStatus.SUCCESS) return;

    await this.prisma.ride.update({
      where: { id: ride.id },
      data: { paymentStatus: PaymentStatus.FAILED },
    });

    this.events.emit('transport.ride.payment_failed', {
      rideId: ride.id,
      paymentId: event.aggregateId,
      customerId: ride.customerId,
    });
  }

  @OnEvent('payments.PaymentRefunded')
  public async onPaymentRefunded(event: PaymentEvent): Promise<void> {
    const rideId = await this.resolveRideId(event);
    if (!rideId) return;

    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) return;

    await this.prisma.ride.update({
      where: { id: ride.id },
      data: { paymentStatus: PaymentStatus.REFUNDED },
    });

    this.events.emit('transport.ride.refund_processed', {
      rideId: ride.id,
      paymentId: event.aggregateId,
      customerId: ride.customerId,
      refundId: event.payload.refundId,
      refundAmount: event.payload.refundAmount,
    });
  }

  private async resolveRideId(event: PaymentEvent): Promise<string | null> {
    const fromPayload = event.payload.rideId;
    if (typeof fromPayload === 'string' && fromPayload.length > 0) {
      return fromPayload;
    }
    const payment = await this.prisma.payment.findUnique({
      where: { id: event.aggregateId },
      select: { rideId: true, purpose: true },
    });
    if (!payment || payment.purpose !== 'RIDE') return null;
    return payment.rideId;
  }
}
