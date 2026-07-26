import { RideStatus } from '@prisma/client';
import {
  rideStatusAlias,
  toUiRideStatus,
} from '../domain/ride-status.mapper';
import {
  fromParcelWeightCategory,
  toParcelWeightCategory,
} from '../domain/weight-category.mapper';

describe('ride-status.mapper', () => {
  it('maps Prisma RideStatus to the UI vocabulary', () => {
    expect(toUiRideStatus(RideStatus.PENDING_PAYMENT)).toBe('PENDING_PAYMENT');
    expect(toUiRideStatus(RideStatus.SEARCHING)).toBe('REQUESTED');
    expect(toUiRideStatus(RideStatus.ASSIGNED)).toBe('ACCEPTED');
    expect(toUiRideStatus(RideStatus.ARRIVING)).toBe('ARRIVED');
    expect(toUiRideStatus(RideStatus.IN_PROGRESS)).toBe('IN_PROGRESS');
    expect(toUiRideStatus(RideStatus.COMPLETED)).toBe('COMPLETED');
    expect(toUiRideStatus(RideStatus.CANCELLED)).toBe('CANCELLED');
    expect(toUiRideStatus(RideStatus.FAILED)).toBe('FAILED');
  });

  it('only aliases IN_PROGRESS to IN_TRANSIT', () => {
    expect(rideStatusAlias(RideStatus.IN_PROGRESS)).toBe('IN_TRANSIT');
    expect(rideStatusAlias(RideStatus.SEARCHING)).toBeUndefined();
    expect(rideStatusAlias(RideStatus.COMPLETED)).toBeUndefined();
  });
});

describe('weight-category.mapper', () => {
  it('accepts Small/Medium/Large in any casing', () => {
    expect(toParcelWeightCategory('Small')).toBe('SMALL');
    expect(toParcelWeightCategory('MEDIUM')).toBe('MEDIUM');
    expect(toParcelWeightCategory('large')).toBe('LARGE');
  });

  it('returns null for missing or unknown values', () => {
    expect(toParcelWeightCategory(undefined)).toBeNull();
    expect(toParcelWeightCategory(null)).toBeNull();
    expect(toParcelWeightCategory('huge')).toBeNull();
  });

  it('round-trips back to title case', () => {
    expect(fromParcelWeightCategory('SMALL' as never)).toBe('Small');
    expect(fromParcelWeightCategory(null)).toBeNull();
  });
});
