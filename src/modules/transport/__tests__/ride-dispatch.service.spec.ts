import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActorType, PaymentStatus, RideServiceType, RideStatus } from '@prisma/client';
import type { AuditLogService } from '../../operations/use-cases/audit-log.service';
import { RideDispatchService } from '../use-cases/ride-dispatch.service';

function buildRideRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-07-26T12:00:00.000Z');
  return {
    id: 'ride1',
    customerId: 'cust1',
    riderId: null,
    serviceType: RideServiceType.RIDE,
    status: RideStatus.SEARCHING,
    vehicleType: 'BIKE',
    pickupLatitude: -0.09,
    pickupLongitude: 34.76,
    dropoffLatitude: -0.1,
    dropoffLongitude: 34.75,
    fareAmount: 170n,
    currency: 'KES',
    paymentStatus: PaymentStatus.SUCCESS,
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildService(prismaOverrides: Record<string, unknown> = {}) {
  const events = new EventEmitter2();
  const audit = { record: jest.fn() } as unknown as AuditLogService;
  const ridersDiscovery = {
    nearby: jest.fn().mockResolvedValue({ success: true, riders: [] }),
  };

  const prisma: {
    ride: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    rider: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    rideStatusHistory: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  } = {
    ride: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    rider: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    rideStatusHistory: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (client: typeof prisma) => Promise<unknown>)(prisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });

  Object.assign(prisma, prismaOverrides);

  const service = new RideDispatchService(
    prisma as never,
    events,
    ridersDiscovery as never,
    audit,
    { submit: jest.fn().mockResolvedValue({ id: 'pod-1' }) } as never,
  );

  return { service, prisma, ridersDiscovery, audit, events };
}

describe('RideDispatchService.autoAssignNearest', () => {
  it('assigns the nearest available rider and emits transport.RiderAssigned', async () => {
    const rideRow = buildRideRow();
    const { service, prisma, ridersDiscovery, events } = buildService();
    prisma.ride.findFirst.mockResolvedValue(rideRow);
    prisma.ride.updateMany.mockResolvedValue({ count: 1 });
    ridersDiscovery.nearby.mockResolvedValue({
      success: true,
      riders: [{ id: 'rider1', distanceKm: 1.2 }],
    });

    const emitSpy = jest.spyOn(events, 'emit');
    const result = await service.autoAssignNearest('ride1');

    expect(result).toEqual({ assigned: true, riderId: 'rider1' });
    expect(prisma.ride.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ride1', status: RideStatus.SEARCHING, riderId: null },
        data: expect.objectContaining({
          status: RideStatus.ASSIGNED,
          riderId: 'rider1',
        }),
      }),
    );
    expect(prisma.rider.update).toHaveBeenCalledWith({
      where: { id: 'rider1' },
      data: { isAvailable: false },
    });
    expect(emitSpy).toHaveBeenCalledWith(
      'transport.RiderAssigned',
      expect.objectContaining({ rideId: 'ride1', riderId: 'rider1' }),
    );
  });

  it('does nothing when there are no nearby riders', async () => {
    const rideRow = buildRideRow();
    const { service, prisma, ridersDiscovery } = buildService();
    prisma.ride.findFirst.mockResolvedValue(rideRow);
    ridersDiscovery.nearby.mockResolvedValue({ success: true, riders: [] });

    const result = await service.autoAssignNearest('ride1');

    expect(result).toEqual({ assigned: false });
    expect(prisma.ride.updateMany).not.toHaveBeenCalled();
  });

  it('does nothing when the ride is not SEARCHING', async () => {
    const rideRow = buildRideRow({ status: RideStatus.ASSIGNED, riderId: 'r0' });
    const { service, prisma, ridersDiscovery } = buildService();
    prisma.ride.findFirst.mockResolvedValue(rideRow);

    const result = await service.autoAssignNearest('ride1');

    expect(result).toEqual({ assigned: false });
    expect(ridersDiscovery.nearby).not.toHaveBeenCalled();
  });

  it('does nothing when the ride no longer exists', async () => {
    const { service, prisma } = buildService();
    prisma.ride.findFirst.mockResolvedValue(null);

    await expect(service.autoAssignNearest('missing')).resolves.toEqual({
      assigned: false,
    });
  });
});

describe('RideDispatchService.updateStatus', () => {
  it('applies a legal transition and records history', async () => {
    const rideRow = buildRideRow({ status: RideStatus.ASSIGNED, riderId: 'rider1' });
    const { service, prisma, events } = buildService();
    prisma.ride.findFirst.mockResolvedValue(rideRow);
    prisma.ride.findUnique.mockResolvedValue({
      ...rideRow,
      status: RideStatus.ARRIVING,
    });

    const emitSpy = jest.spyOn(events, 'emit');
    const result = await service.updateStatus('ride1', 'ARRIVED', {
      actorId: 'rider1',
      actorType: ActorType.USER,
      role: 'RIDER',
    });

    expect(result.status).toBe(RideStatus.ARRIVING);
    expect(prisma.rideStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rideId: 'ride1',
          fromStatus: RideStatus.ASSIGNED,
          toStatus: RideStatus.ARRIVING,
        }),
      }),
    );
    expect(emitSpy).toHaveBeenCalledWith(
      'transport.RideStatusChanged',
      expect.objectContaining({
        rideId: 'ride1',
        fromStatus: RideStatus.ASSIGNED,
        toStatus: RideStatus.ARRIVING,
      }),
    );
  });

  it('frees up the rider on COMPLETED', async () => {
    const rideRow = buildRideRow({ status: RideStatus.IN_PROGRESS, riderId: 'rider1' });
    const { service, prisma } = buildService();
    prisma.ride.findFirst.mockResolvedValue(rideRow);
    prisma.ride.findUnique.mockResolvedValue({
      ...rideRow,
      status: RideStatus.COMPLETED,
    });

    await service.updateStatus('ride1', 'COMPLETED', {
      actorId: 'rider1',
      actorType: ActorType.USER,
      role: 'RIDER',
    });

    expect(prisma.rider.update).toHaveBeenCalledWith({
      where: { id: 'rider1' },
      data: { isAvailable: true },
    });
  });

  it('rejects illegal transitions before writing anything', async () => {
    const rideRow = buildRideRow({ status: RideStatus.SEARCHING });
    const { service, prisma } = buildService();
    prisma.ride.findFirst.mockResolvedValue(rideRow);

    await expect(
      service.updateStatus('ride1', 'IN_PROGRESS', {
        actorId: 'admin1',
        actorType: ActorType.ADMIN,
        role: 'ADMIN',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ride.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for a missing ride', async () => {
    const { service, prisma } = buildService();
    prisma.ride.findFirst.mockResolvedValue(null);

    await expect(
      service.updateStatus('missing', 'ASSIGNED', {
        actorId: 'admin1',
        actorType: ActorType.ADMIN,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RideDispatchService.assignRider', () => {
  it('assigns a rider manually and moves the ride to ASSIGNED', async () => {
    const rideRow = buildRideRow({ status: RideStatus.SEARCHING });
    const { service, prisma, events } = buildService();
    prisma.ride.findFirst.mockResolvedValue(rideRow);
    prisma.rider.findFirst.mockResolvedValue({ id: 'rider1' });
    prisma.ride.findUnique.mockResolvedValue({
      ...rideRow,
      status: RideStatus.ASSIGNED,
      riderId: 'rider1',
    });

    const emitSpy = jest.spyOn(events, 'emit');
    const result = await service.assignRider('ride1', 'rider1', 'admin1');

    expect(result.status).toBe(RideStatus.ASSIGNED);
    expect(prisma.ride.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ride1' },
        data: expect.objectContaining({ riderId: 'rider1', status: RideStatus.ASSIGNED }),
      }),
    );
    expect(emitSpy).toHaveBeenCalledWith(
      'transport.RiderAssigned',
      expect.objectContaining({ rideId: 'ride1', riderId: 'rider1' }),
    );
  });

  it('rejects assignment on a terminal ride', async () => {
    const rideRow = buildRideRow({ status: RideStatus.COMPLETED });
    const { service, prisma } = buildService();
    prisma.ride.findFirst.mockResolvedValue(rideRow);

    await expect(
      service.assignRider('ride1', 'rider1', 'admin1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException when the rider does not exist', async () => {
    const rideRow = buildRideRow({ status: RideStatus.SEARCHING });
    const { service, prisma } = buildService();
    prisma.ride.findFirst.mockResolvedValue(rideRow);
    prisma.rider.findFirst.mockResolvedValue(null);

    await expect(
      service.assignRider('ride1', 'missing-rider', 'admin1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
