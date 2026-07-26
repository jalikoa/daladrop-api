import { RideStatus } from '@prisma/client';

/**
 * UI-facing ride status vocabulary consumed by the customer app
 * (`REQUESTED | ACCEPTED | ARRIVED | PICKED_UP | IN_TRANSIT | IN_PROGRESS |
 * COMPLETED | CANCELLED | PENDING_PAYMENT`). We map from the narrower Prisma
 * `RideStatus` and always expose both the raw value (`status`) and the
 * mapped value (`uiStatus`) on ride views so old and new clients keep working.
 */
export type UiRideStatus =
  | 'PENDING_PAYMENT'
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'
  | 'REJECTED';

const STATUS_MAP: Record<RideStatus, UiRideStatus> = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  SEARCHING: 'REQUESTED',
  ASSIGNED: 'ACCEPTED',
  ARRIVING: 'ARRIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
};

export function toUiRideStatus(status: RideStatus): UiRideStatus {
  return STATUS_MAP[status];
}

/**
 * Secondary alias some screens expect alongside `uiStatus`
 * (e.g. the trip-in-progress stepper reads `IN_TRANSIT`). Returns
 * `undefined` when the primary `uiStatus` value is already sufficient.
 */
export function rideStatusAlias(status: RideStatus): string | undefined {
  if (status === RideStatus.IN_PROGRESS) return 'IN_TRANSIT';
  return undefined;
}
