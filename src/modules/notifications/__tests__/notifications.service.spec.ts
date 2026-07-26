import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../use-cases/notifications.service';

describe('NotificationsService', () => {
  const prisma = {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
  };
  const preferences = {
    isChannelEnabled: jest.fn().mockResolvedValue(true),
  };
  const pushDelivery = {
    sendToUser: jest.fn().mockResolvedValue({ sent: 0 }),
  };

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    preferences.isChannelEnabled.mockResolvedValue(true);
    service = new NotificationsService(
      prisma as never,
      preferences as never,
      pushDelivery as never,
    );
  });

  it('lists notifications with pagination and unreadCount', async () => {
    const row = {
      id: 'n1',
      userId: 'u1',
      type: 'FOOD_ORDER',
      title: 'Paid',
      body: 'Order paid',
      rideId: null,
      orderId: 'o1',
      bookingId: null,
      data: null,
      readAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
    };
    prisma.notification.findMany.mockResolvedValue([row]);
    prisma.notification.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const result = await service.list('u1', { page: '1', limit: '20' });
    expect(result.success).toBe(true);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]).toMatchObject({
      id: 'n1',
      type: 'FOOD_ORDER',
      read: false,
      orderId: 'o1',
    });
    expect(result.unreadCount).toBe(1);
  });

  it('rejects get for another user', async () => {
    prisma.notification.findFirst.mockResolvedValue({
      id: 'n1',
      userId: 'other',
      deletedAt: null,
    });
    await expect(service.get('u1', 'n1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('soft-deletes owned notification', async () => {
    prisma.notification.findFirst.mockResolvedValue({
      id: 'n1',
      userId: 'u1',
      deletedAt: null,
      type: 'RIDE_STATUS',
      title: 't',
      body: 'b',
      rideId: null,
      orderId: null,
      bookingId: null,
      data: null,
      readAt: null,
      createdAt: new Date(),
    });
    prisma.notification.update.mockResolvedValue({});
    await expect(service.softDelete('u1', 'n1')).resolves.toEqual({
      success: true,
    });
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'n1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('throws NotFound when notification missing', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);
    await expect(service.get('u1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates in-app notification and fans out push', async () => {
    prisma.notification.create.mockResolvedValue({ id: 'n2' });
    await service.createInApp({
      userId: 'u1',
      type: 'RIDE_COMPLETED',
      title: 'Done',
      body: 'Rate your rider',
      rideId: 'r1',
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        type: 'RIDE_COMPLETED',
        rideId: 'r1',
      }),
    });
    expect(pushDelivery.sendToUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        type: 'RIDE_COMPLETED',
        data: expect.objectContaining({ rideId: 'r1' }),
      }),
    );
  });
});
