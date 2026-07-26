import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ModuleOrderStatus, RideStatus } from '@prisma/client';
import { CustomerPlacesService } from '../use-cases/customer-places.service';
import { CustomerActivityService } from '../use-cases/customer-activity.service';
import type { PrismaService } from '../../../database/prisma/prisma.service';

describe('CustomerPlacesService', () => {
  it('lists and replaces saved places transactionally', async () => {
    const places = [
      {
        id: 'p1',
        label: 'Home',
        icon: 'home',
        address: 'Nairobi',
        pinned: true,
      },
    ];
    const prisma = {
      savedPlace: {
        findMany: jest.fn().mockResolvedValue(places),
        updateMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          savedPlace: {
            updateMany: jest.fn(),
            createMany: jest.fn(),
          },
        }),
      ),
    } as unknown as PrismaService;
    const service = new CustomerPlacesService(prisma);
    await expect(service.list('u1')).resolves.toEqual({
      success: true,
      places,
    });
    await expect(
      service.replace('u1', {
        places: [{ label: 'Work', address: 'Westlands', pinned: false }],
      }),
    ).resolves.toEqual({ success: true, places });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('covers empty place replace and optional icon defaults', async () => {
    const updateMany = jest.fn();
    const createMany = jest.fn();
    const prisma = {
      savedPlace: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany,
        createMany,
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ savedPlace: { updateMany, createMany } }),
      ),
    } as unknown as PrismaService;
    const service = new CustomerPlacesService(prisma);
    await expect(service.replace('u1', { places: [] })).resolves.toEqual({
      success: true,
      places: [],
    });
    expect(createMany).not.toHaveBeenCalled();
    await service.replace('u1', {
      places: [{ label: 'Gym', address: 'Kilimani' }],
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          icon: null,
          pinned: false,
          sortOrder: 0,
        }),
      ],
    });
  });
});

describe('CustomerActivityService', () => {
  it('returns stats for self and blocks cross-user access', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'u1' }),
      },
      ride: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([]),
      },
      order: {
        count: jest.fn().mockResolvedValue(3),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { totalAmount: 1500n } }),
      },
    } as unknown as PrismaService;
    const service = new CustomerActivityService(prisma);

    await expect(service.history('u1', 'u1')).resolves.toEqual({
      success: true,
      history: [],
    });
    await expect(service.stats('u1', 'u1')).resolves.toEqual({
      success: true,
      stats: {
        ridesCompleted: 2,
        ordersCompleted: 3,
        totalSpent: 1500,
      },
    });
    expect(prisma.ride.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: RideStatus.COMPLETED }),
      }),
    );
    expect(prisma.order.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ModuleOrderStatus.DELIVERED,
        }),
      }),
    );

    await expect(service.stats('u1', 'u2')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce(null);
    await expect(service.history('u1', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
