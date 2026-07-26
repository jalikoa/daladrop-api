import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuleOrderStatus, Ride, RideStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { toUiRideStatus } from '../../transport/domain/ride-status.mapper';

/**
 * Profile-facing customer activity.
 * Ride lifecycle ownership stays with `transport`; this service reads/hides
 * `Ride` rows directly per Phase 7 (`customerHiddenAt`) since history is a
 * customer-profile concern, not a transport lifecycle concern.
 */
@Injectable()
export class CustomerActivityService {
  public constructor(private readonly prisma: PrismaService) {}

  public async history(actorId: string, userId: string) {
    await this.assertSelf(actorId, userId);
    const rides = await this.prisma.ride.findMany({
      where: { customerId: userId, customerHiddenAt: null, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const history = rides.map((ride) => this.toHistoryItem(ride));
    return { success: true as const, history };
  }

  public async hideHistoryItem(
    actorId: string,
    userId: string,
    rideId: string,
  ) {
    await this.assertSelf(actorId, userId);
    const ride = await this.prisma.ride.findFirst({
      where: { id: rideId, customerId: userId, deletedAt: null },
      select: { id: true },
    });
    if (!ride) throw new NotFoundException('Ride not found');
    await this.prisma.ride.update({
      where: { id: rideId },
      data: { customerHiddenAt: new Date() },
    });
    return { success: true as const };
  }

  public async hideOrderHistoryItem(
    actorId: string,
    userId: string,
    orderId: string,
  ) {
    await this.assertSelf(actorId, userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: userId, deletedAt: null },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    await this.prisma.order.update({
      where: { id: orderId },
      data: { customerHiddenAt: new Date() },
    });
    return { success: true as const };
  }

  public async hideAllHistory(actorId: string, userId: string) {
    await this.assertSelf(actorId, userId);
    await this.prisma.ride.updateMany({
      where: { customerId: userId, customerHiddenAt: null, deletedAt: null },
      data: { customerHiddenAt: new Date() },
    });
    return { success: true as const };
  }

  private toHistoryItem(ride: Ride) {
    return {
      id: ride.id,
      status: ride.status,
      uiStatus: toUiRideStatus(ride.status),
      serviceType: ride.serviceType,
      fare: Number(ride.fareAmount),
      currency: ride.currency,
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      createdAt: ride.createdAt.toISOString(),
      completedAt: ride.completedAt ? ride.completedAt.toISOString() : null,
    };
  }

  public async stats(actorId: string, userId: string) {
    await this.assertSelf(actorId, userId);
    const [ridesCompleted, ordersCompleted, spent] = await Promise.all([
      this.prisma.ride.count({
        where: {
          customerId: userId,
          status: RideStatus.COMPLETED,
          customerHiddenAt: null,
        },
      }),
      this.prisma.order.count({
        where: {
          customerId: userId,
          status: ModuleOrderStatus.DELIVERED,
          customerHiddenAt: null,
        },
      }),
      this.prisma.order.aggregate({
        where: {
          customerId: userId,
          status: ModuleOrderStatus.DELIVERED,
          customerHiddenAt: null,
        },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      success: true as const,
      stats: {
        ridesCompleted,
        ordersCompleted,
        totalSpent: Number(spent._sum.totalAmount ?? 0),
      },
    };
  }

  private async assertSelf(actorId: string, userId: string): Promise<void> {
    if (actorId !== userId) {
      throw new ForbiddenException('Cannot access another customer profile');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
  }
}
