import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActorType, AuditAction, Prisma, RideStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ProofOfDeliveryService } from '../../logistics/use-cases/proof-of-delivery.service';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';
import { assertTransition, resolveRideStatusInput } from '../domain/ride-lifecycle';
import { toRideSummaryView, type RideSummaryView } from '../domain/ride-view';
import { RidersDiscoveryService } from './riders-discovery.service';

const RIDES_TABLE = 'rides';
const ASSIGNABLE_STATUSES: readonly RideStatus[] = [
  RideStatus.SEARCHING,
  RideStatus.ASSIGNED,
];

export interface RideStatusActor {
  readonly actorId: string;
  readonly actorType: ActorType;
  readonly role?: 'RIDER' | 'ADMIN' | 'CUSTOMER' | 'SYSTEM';
}

export interface AutoAssignResult {
  readonly assigned: boolean;
  readonly riderId?: string;
}

/**
 * Owns ride assignment + status-transition orchestration (Phase 13/14).
 * Kept independent from `RidesService` (no circular dependency) so both the
 * customer-facing service and the payment listener can trigger dispatch.
 */
@Injectable()
export class RideDispatchService {
  private readonly logger = new Logger(RideDispatchService.name);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly ridersDiscovery: RidersDiscoveryService,
    private readonly audit: AuditLogService,
    private readonly pod: ProofOfDeliveryService,
  ) {}

  /**
   * Finds the nearest available rider to the ride's pickup point and
   * assigns them, best-effort. Never throws for "no riders found" — callers
   * (payment listener, `RidesService.request`) should leave the ride
   * `SEARCHING` and let a later retry / manual admin assign pick it up.
   */
  public async autoAssignNearest(rideId: string): Promise<AutoAssignResult> {
    const ride = await this.prisma.ride.findFirst({
      where: { id: rideId, deletedAt: null },
    });
    if (!ride || ride.status !== RideStatus.SEARCHING || ride.riderId) {
      return { assigned: false };
    }

    const pickupLat = Number(ride.pickupLatitude);
    const pickupLng = Number(ride.pickupLongitude);
    if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) {
      return { assigned: false };
    }

    const nearby = await this.ridersDiscovery.nearby(pickupLat, pickupLng);
    const nearest = nearby.riders[0];
    if (!nearest) {
      this.logger.debug(`No available riders near ride ${rideId}`);
      return { assigned: false };
    }

    const now = new Date();
    const assignedRideId = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ride.updateMany({
        where: { id: rideId, status: RideStatus.SEARCHING, riderId: null },
        data: {
          status: RideStatus.ASSIGNED,
          riderId: nearest.id,
          assignedAt: now,
        },
      });
      if (result.count === 0) return null;

      await tx.rideStatusHistory.create({
        data: {
          rideId,
          fromStatus: RideStatus.SEARCHING,
          toStatus: RideStatus.ASSIGNED,
          actorType: ActorType.SYSTEM,
          reason: `Auto-assigned nearest rider ${nearest.id}`,
        },
      });
      await tx.rider.update({
        where: { id: nearest.id },
        data: { isAvailable: false },
      });
      return rideId;
    });

    if (!assignedRideId) {
      this.logger.debug(`Ride ${rideId} was already assigned elsewhere`);
      return { assigned: false };
    }

    this.events.emit('transport.RiderAssigned', {
      rideId,
      riderId: nearest.id,
      customerId: ride.customerId,
      assignedAt: now.toISOString(),
      auto: true,
    });

    return { assigned: true, riderId: nearest.id };
  }

  /**
   * Admin manual assign (also reused by the rider `accept` endpoint with
   * `actorType = ActorType.USER`). Allowed while `SEARCHING` (first assign)
   * or `ASSIGNED` (reassign to a different rider).
   */
  public async assignRider(
    rideId: string,
    riderId: string,
    actorId: string,
    actorType: ActorType = ActorType.ADMIN,
  ): Promise<RideSummaryView> {
    const ride = await this.prisma.ride.findFirst({
      where: { id: rideId, deletedAt: null },
    });
    if (!ride) throw new NotFoundException('Ride not found');
    if (!ASSIGNABLE_STATUSES.includes(ride.status)) {
      throw new BadRequestException(
        `Cannot assign a rider while ride is ${ride.status}`,
      );
    }

    const rider = await this.prisma.rider.findFirst({
      where: { id: riderId, deletedAt: null },
    });
    if (!rider) throw new NotFoundException('Rider not found');

    const now = new Date();
    const previousRiderId = ride.riderId;
    await this.prisma.$transaction(async (tx) => {
      await tx.ride.update({
        where: { id: rideId },
        data: {
          riderId,
          status: RideStatus.ASSIGNED,
          assignedAt: ride.assignedAt ?? now,
        },
      });
      await tx.rideStatusHistory.create({
        data: {
          rideId,
          fromStatus: ride.status,
          toStatus: RideStatus.ASSIGNED,
          actorType,
          actorId,
          reason:
            actorType === ActorType.ADMIN
              ? `Manually assigned rider ${riderId} by admin`
              : `Rider ${riderId} accepted the ride`,
        },
      });
      await tx.rider.update({
        where: { id: riderId },
        data: { isAvailable: false },
      });
      if (previousRiderId && previousRiderId !== riderId) {
        await tx.rider.update({
          where: { id: previousRiderId },
          data: { isAvailable: true },
        });
      }
    });

    await this.audit.record({
      tableName: RIDES_TABLE,
      recordId: rideId,
      action: AuditAction.STATUS_CHANGE,
      actorId,
      actorType,
      afterData: { status: RideStatus.ASSIGNED, riderId },
      reason: 'Rider assigned',
    });

    this.events.emit('transport.RiderAssigned', {
      rideId,
      riderId,
      customerId: ride.customerId,
      assignedAt: now.toISOString(),
      auto: false,
    });

    return this.requireRideView(rideId);
  }

  /**
   * Validates the lifecycle transition, persists timestamps, writes
   * `RideStatusHistory`, frees up the rider on terminal states, and emits
   * `transport.RideStatusChanged`.
   */
  public async updateStatus(
    rideId: string,
    toStatus: string,
    actor: RideStatusActor,
    reason?: string,
    pod?: {
      readonly podPhotoUrl?: string;
      readonly podSignatureUrl?: string;
      readonly podNotes?: string;
    },
  ): Promise<RideSummaryView> {
    const ride = await this.prisma.ride.findFirst({
      where: { id: rideId, deletedAt: null },
    });
    if (!ride) throw new NotFoundException('Ride not found');

    const resolvedTo = resolveRideStatusInput(toStatus);
    assertTransition(ride.status, resolvedTo);

    const now = new Date();
    const data: Prisma.RideUpdateInput = { status: resolvedTo };
    if (resolvedTo === RideStatus.ASSIGNED && !ride.assignedAt) {
      data.assignedAt = now;
    }
    if (resolvedTo === RideStatus.IN_PROGRESS) {
      data.startedAt = now;
    }
    if (resolvedTo === RideStatus.COMPLETED) {
      data.completedAt = now;
      if (pod?.podPhotoUrl) data.podPhotoUrl = pod.podPhotoUrl;
      if (pod?.podSignatureUrl) data.podSignatureUrl = pod.podSignatureUrl;
      if (pod?.podNotes) data.podNotes = pod.podNotes;
    }
    if (resolvedTo === RideStatus.REJECTED) {
      data.rider = { disconnect: true };
    }
    if (resolvedTo === RideStatus.CANCELLED) {
      data.cancelledAt = now;
      data.cancelReason = reason ?? ride.cancelReason ?? null;
    }

    const historyReason =
      reason ?? `Status changed to ${resolvedTo} by ${actor.role ?? actor.actorType}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.ride.update({ where: { id: rideId }, data });
      await tx.rideStatusHistory.create({
        data: {
          rideId,
          fromStatus: ride.status,
          toStatus: resolvedTo,
          actorType: actor.actorType,
          actorId: actor.actorId,
          reason: historyReason,
        },
      });
      if (
        ride.riderId &&
        (resolvedTo === RideStatus.COMPLETED ||
          resolvedTo === RideStatus.CANCELLED)
      ) {
        await tx.rider.update({
          where: { id: ride.riderId },
          data: { isAvailable: true },
        });
      }
    });

    await this.audit.record({
      tableName: RIDES_TABLE,
      recordId: rideId,
      action: AuditAction.STATUS_CHANGE,
      actorId: actor.actorId,
      actorType: actor.actorType,
      afterData: { status: resolvedTo },
      reason: historyReason,
    });

    const payload = {
      rideId,
      customerId: ride.customerId,
      riderId: ride.riderId,
      fromStatus: ride.status,
      toStatus: resolvedTo,
      actorId: actor.actorId,
      actorType: actor.actorType,
      reason: historyReason,
    };
    // Snake_case is the notification/CQRS contract; PascalCase kept for legacy listeners.
    this.events.emit('transport.ride.status_changed', payload);
    this.events.emit('transport.RideStatusChanged', payload);

    if (
      resolvedTo === RideStatus.COMPLETED &&
      (pod?.podPhotoUrl || pod?.podSignatureUrl || pod?.podNotes)
    ) {
      try {
        await this.pod.submit({
          rideId,
          actorId: actor.actorId,
          actorType: actor.actorType,
          photoUrl: pod.podPhotoUrl,
          signatureUrl: pod.podSignatureUrl,
          notes: pod.podNotes,
        });
      } catch (error) {
        this.logger.warn(
          `POD mirror failed for ride ${rideId}: ${(error as Error).message}`,
        );
      }
    }

    if (resolvedTo === RideStatus.REJECTED) {
      return this.updateStatus(
        rideId,
        RideStatus.SEARCHING,
        { actorId: actor.actorId, actorType: ActorType.SYSTEM, role: 'SYSTEM' },
        'Auto-research after rider rejection',
      );
    }

    return this.requireRideView(rideId);
  }

  private async requireRideView(rideId: string): Promise<RideSummaryView> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new NotFoundException('Ride not found');
    return toRideSummaryView(ride);
  }
}
