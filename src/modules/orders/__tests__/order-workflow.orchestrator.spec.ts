import { OrderWorkflowOrchestrator } from '../listeners/order-workflow.orchestrator';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import type { RealtimeService } from '../../../platform/realtime/realtime.service';
import type { NotificationsService } from '../../notifications/use-cases/notifications.service';

describe('OrderWorkflowOrchestrator', () => {
  it('writes OrderCreated outbox and notifies customer on orders.placed', async () => {
    const append = jest.fn().mockResolvedValue(undefined);
    const createInApp = jest.fn().mockResolvedValue({});
    const publishToRoom = jest.fn().mockResolvedValue({});
    const publishToUser = jest.fn().mockResolvedValue({});

    const prisma = {
      order: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const realtime = {
      isEnabled: true,
      publishToRoom,
      publishToUser,
    } as unknown as RealtimeService;
    const notifications = { createInApp } as unknown as NotificationsService;

    const orchestrator = new OrderWorkflowOrchestrator(
      prisma,
      realtime,
      notifications,
    );
    (orchestrator as unknown as { outbox: { append: typeof append } }).outbox = {
      append,
    };

    await orchestrator.onPlaced({
      orderIds: ['o1'],
      customerId: 'c1',
      moduleType: 'FOOD' as never,
    });

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'OrderCreated',
        aggregateId: 'o1',
      }),
    );
    expect(createInApp).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'c1', orderId: 'o1' }),
    );
    expect(publishToUser).toHaveBeenCalled();
  });
});
