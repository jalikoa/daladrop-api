import { BadRequestException } from '@nestjs/common';
import { RideStatus } from '@prisma/client';
import {
  assertTransition,
  isAllowedRideTransition,
  resolveRideStatusInput,
} from '../domain/ride-lifecycle';

describe('ride-lifecycle transitions', () => {
  it('allows the documented happy-path edges', () => {
    expect(
      isAllowedRideTransition(RideStatus.PENDING_PAYMENT, RideStatus.SEARCHING),
    ).toBe(true);
    expect(isAllowedRideTransition(RideStatus.SEARCHING, RideStatus.ASSIGNED)).toBe(
      true,
    );
    expect(isAllowedRideTransition(RideStatus.ASSIGNED, RideStatus.ARRIVING)).toBe(
      true,
    );
    expect(
      isAllowedRideTransition(RideStatus.ARRIVING, RideStatus.IN_PROGRESS),
    ).toBe(true);
    expect(
      isAllowedRideTransition(RideStatus.IN_PROGRESS, RideStatus.COMPLETED),
    ).toBe(true);
  });

  it('allows cancellation from every non-terminal state', () => {
    expect(
      isAllowedRideTransition(RideStatus.PENDING_PAYMENT, RideStatus.CANCELLED),
    ).toBe(true);
    expect(isAllowedRideTransition(RideStatus.SEARCHING, RideStatus.CANCELLED)).toBe(
      true,
    );
    expect(isAllowedRideTransition(RideStatus.ASSIGNED, RideStatus.CANCELLED)).toBe(
      true,
    );
    expect(isAllowedRideTransition(RideStatus.ARRIVING, RideStatus.CANCELLED)).toBe(
      true,
    );
    expect(
      isAllowedRideTransition(RideStatus.IN_PROGRESS, RideStatus.CANCELLED),
    ).toBe(true);
  });

  it('allows failure only before assignment', () => {
    expect(
      isAllowedRideTransition(RideStatus.PENDING_PAYMENT, RideStatus.FAILED),
    ).toBe(true);
    expect(isAllowedRideTransition(RideStatus.SEARCHING, RideStatus.FAILED)).toBe(
      true,
    );
    expect(isAllowedRideTransition(RideStatus.ASSIGNED, RideStatus.FAILED)).toBe(
      false,
    );
  });

  it('rejects skipping states', () => {
    expect(
      isAllowedRideTransition(RideStatus.SEARCHING, RideStatus.IN_PROGRESS),
    ).toBe(false);
    expect(
      isAllowedRideTransition(RideStatus.PENDING_PAYMENT, RideStatus.ASSIGNED),
    ).toBe(false);
    expect(
      isAllowedRideTransition(RideStatus.ASSIGNED, RideStatus.COMPLETED),
    ).toBe(false);
  });

  it('treats terminal states as having no outbound edges', () => {
    expect(
      isAllowedRideTransition(RideStatus.COMPLETED, RideStatus.SEARCHING),
    ).toBe(false);
    expect(
      isAllowedRideTransition(RideStatus.CANCELLED, RideStatus.SEARCHING),
    ).toBe(false);
    expect(isAllowedRideTransition(RideStatus.FAILED, RideStatus.SEARCHING)).toBe(
      false,
    );
  });

  it('assertTransition throws BadRequestException for illegal edges', () => {
    expect(() =>
      assertTransition(RideStatus.SEARCHING, RideStatus.IN_PROGRESS),
    ).toThrow(BadRequestException);
    expect(() =>
      assertTransition(RideStatus.COMPLETED, RideStatus.CANCELLED),
    ).toThrow(BadRequestException);
  });

  it('assertTransition does not throw for legal edges', () => {
    expect(() =>
      assertTransition(RideStatus.SEARCHING, RideStatus.ASSIGNED),
    ).not.toThrow();
  });
});

describe('resolveRideStatusInput', () => {
  it('accepts canonical RideStatus values in any casing', () => {
    expect(resolveRideStatusInput('ASSIGNED')).toBe(RideStatus.ASSIGNED);
    expect(resolveRideStatusInput('assigned')).toBe(RideStatus.ASSIGNED);
  });

  it('maps UI aliases to canonical statuses', () => {
    expect(resolveRideStatusInput('ACCEPTED')).toBe(RideStatus.ASSIGNED);
    expect(resolveRideStatusInput('arrived')).toBe(RideStatus.ARRIVING);
    expect(resolveRideStatusInput('PICKED_UP')).toBe(RideStatus.IN_PROGRESS);
    expect(resolveRideStatusInput('in_transit')).toBe(RideStatus.IN_PROGRESS);
    expect(resolveRideStatusInput('REQUESTED')).toBe(RideStatus.SEARCHING);
  });

  it('throws BadRequestException for unknown values', () => {
    expect(() => resolveRideStatusInput('NOT_A_STATUS')).toThrow(
      BadRequestException,
    );
    expect(() => resolveRideStatusInput('')).toThrow(BadRequestException);
  });
});
