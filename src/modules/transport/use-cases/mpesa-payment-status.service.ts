import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';

/**
 * Backs both `GET /api/v1/mpesa/payment-status/:rideId` (version-neutral alias)
 * and `GET /v1/mpesa/payment-status/:rideId` (canonical). Returns the ride's
 * latest RIDE payment attempt so the tracking/payment screens can poll a
 * single, uppercase `PublicPaymentStatus`-shaped status.
 */
@Injectable()
export class MpesaPaymentStatusService {
  public constructor(private readonly prisma: PrismaService) {}

  public async getForRide(rideId: string, userId?: string) {
    const ride = await this.prisma.ride.findFirst({
      where: { id: rideId, deletedAt: null },
      select: { id: true, customerId: true },
    });
    if (!ride) throw new NotFoundException('Ride not found');
    if (userId && ride.customerId !== userId) {
      throw new ForbiddenException(
        'Cannot access another user ride payment status',
      );
    }

    const payment = await this.prisma.payment.findFirst({
      where: { rideId, purpose: 'RIDE' },
      orderBy: { createdAt: 'desc' },
      include: {
        providerTransactions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!payment) {
      return { success: true as const, payment: null };
    }

    const transaction = payment.providerTransactions[0];
    return {
      success: true as const,
      payment: {
        id: payment.id,
        status: payment.status,
        amount: Number(payment.amount),
        mpesaRef: transaction?.providerReference ?? null,
        phoneNumber: transaction?.payerIdentifier ?? null,
        checkoutRequestId: transaction?.checkoutRequestId ?? null,
        createdAt: payment.createdAt.toISOString(),
      },
    };
  }
}
