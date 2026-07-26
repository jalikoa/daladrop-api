import type { Ride } from '@prisma/client';
import { rideStatusAlias, toUiRideStatus } from './ride-status.mapper';

/**
 * Shared ride → API view mapper used by dispatch/admin/rider surfaces so the
 * shape stays consistent with `RidesService.toRideView` (customer surface)
 * without duplicating the field list in every new controller/service.
 */
export function toRideSummaryView(ride: Ride) {
  const uiStatus = toUiRideStatus(ride.status);
  return {
    id: ride.id,
    customerId: ride.customerId,
    riderId: ride.riderId,
    serviceType: ride.serviceType,
    status: ride.status,
    uiStatus,
    statusAlias: rideStatusAlias(ride.status) ?? uiStatus,
    paymentStatus: ride.paymentStatus,
    vehicleType: ride.vehicleType,
    pickupAddress: ride.pickupAddress,
    pickupLat: Number(ride.pickupLatitude),
    pickupLng: Number(ride.pickupLongitude),
    dropoffAddress: ride.dropoffAddress,
    dropoffLat: Number(ride.dropoffLatitude),
    dropoffLng: Number(ride.dropoffLongitude),
    fare: Number(ride.fareAmount),
    currency: ride.currency,
    distanceKm: ride.distanceKm != null ? Number(ride.distanceKm) : null,
    polyline: ride.polyline,
    itemDescription: ride.itemDescription,
    receiverPhone: ride.receiverPhone,
    weightCategory: ride.weightCategory,
    parcelSize: ride.parcelSize,
    courierPartnerId: ride.courierPartnerId,
    interCountyRouteId: ride.interCountyRouteId,
    cancelReason: ride.cancelReason,
    etaMinutes: ride.etaMinutes,
    surgeMultiplier:
      ride.surgeMultiplier != null ? Number(ride.surgeMultiplier) : null,
    podPhotoUrl: ride.podPhotoUrl,
    podSignatureUrl: ride.podSignatureUrl,
    podNotes: ride.podNotes,
    createdAt: ride.createdAt.toISOString(),
    updatedAt: ride.updatedAt.toISOString(),
    assignedAt: ride.assignedAt ? ride.assignedAt.toISOString() : null,
    startedAt: ride.startedAt ? ride.startedAt.toISOString() : null,
    completedAt: ride.completedAt ? ride.completedAt.toISOString() : null,
    cancelledAt: ride.cancelledAt ? ride.cancelledAt.toISOString() : null,
  };
}

export type RideSummaryView = ReturnType<typeof toRideSummaryView>;
