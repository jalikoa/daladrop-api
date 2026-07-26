import { BadRequestException } from '@nestjs/common';
import { RideStatus } from '@prisma/client';

/**
 * Canonical ride lifecycle graph (Phase 13/14). Terminal states
 * (`COMPLETED`/`CANCELLED`/`FAILED`) never transition further.
 */
export const RIDE_STATUS_TRANSITIONS: Readonly<
  Record<RideStatus, readonly RideStatus[]>
> = {
  [RideStatus.PENDING_PAYMENT]: [
    RideStatus.SEARCHING,
    RideStatus.CANCELLED,
    RideStatus.FAILED,
  ],
  [RideStatus.SEARCHING]: [
    RideStatus.ASSIGNED,
    RideStatus.CANCELLED,
    RideStatus.FAILED,
  ],
  [RideStatus.ASSIGNED]: [
    RideStatus.ARRIVING,
    RideStatus.REJECTED,
    RideStatus.CANCELLED,
  ],
  [RideStatus.REJECTED]: [
    RideStatus.SEARCHING,
    RideStatus.CANCELLED,
    RideStatus.FAILED,
  ],
  [RideStatus.ARRIVING]: [RideStatus.IN_PROGRESS, RideStatus.CANCELLED],
  [RideStatus.IN_PROGRESS]: [RideStatus.COMPLETED, RideStatus.CANCELLED],
  [RideStatus.COMPLETED]: [],
  [RideStatus.CANCELLED]: [],
  [RideStatus.FAILED]: [],
};

/**
 * UI-facing aliases some client screens (and older mobile builds) send
 * instead of the canonical Prisma `RideStatus` values. Kept separate from
 * `domain/ride-status.mapper.ts` (which maps Prisma → UI for *reads*) —
 * this map is for *writes* (status update requests).
 */
const RIDE_STATUS_INPUT_ALIASES: Readonly<Record<string, RideStatus>> = {
  REQUESTED: RideStatus.SEARCHING,
  ACCEPTED: RideStatus.ASSIGNED,
  DRIVER_ACCEPTED: RideStatus.ASSIGNED,
  DRIVER_REJECTED: RideStatus.REJECTED,
  REJECTED: RideStatus.REJECTED,
  ARRIVED: RideStatus.ARRIVING,
  DRIVER_ARRIVED: RideStatus.ARRIVING,
  DRIVER_ARRIVING: RideStatus.ARRIVING,
  PICKED_UP: RideStatus.IN_PROGRESS,
  PASSENGER_BOARDED: RideStatus.IN_PROGRESS,
  RIDE_STARTED: RideStatus.IN_PROGRESS,
  IN_TRANSIT: RideStatus.IN_PROGRESS,
};

export function isAllowedRideTransition(
  from: RideStatus,
  to: RideStatus,
): boolean {
  return RIDE_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Throws `BadRequestException` when `from -> to` is not an allowed edge. */
export function assertTransition(from: RideStatus, to: RideStatus): void {
  if (!isAllowedRideTransition(from, to)) {
    throw new BadRequestException(
      `Cannot transition ride from ${from} to ${to}`,
    );
  }
}

/**
 * Resolves a free-form status string (canonical `RideStatus` or a UI alias,
 * in any casing) to a canonical `RideStatus`. Throws `BadRequestException`
 * for unknown values.
 */
export function resolveRideStatusInput(value: string): RideStatus {
  const key = value?.trim().toUpperCase();
  if (!key) {
    throw new BadRequestException('status is required');
  }
  if ((Object.values(RideStatus) as string[]).includes(key)) {
    return key as RideStatus;
  }
  const alias = RIDE_STATUS_INPUT_ALIASES[key];
  if (alias) return alias;
  throw new BadRequestException(`Unknown ride status: ${value}`);
}
