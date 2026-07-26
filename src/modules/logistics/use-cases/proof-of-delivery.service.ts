import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActorType, AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PrismaOutboxWriter } from '../../../infrastructure/database/outbox/prisma-outbox.writer';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';

export interface SubmitPodInput {
  readonly orderId?: string;
  readonly rideId?: string;
  readonly photoUrl?: string;
  readonly signatureUrl?: string;
  readonly recipientName?: string;
  readonly notes?: string;
  readonly otpCode?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly actorId: string;
  readonly actorType?: ActorType;
}

@Injectable()
export class ProofOfDeliveryService {
  private readonly outbox: PrismaOutboxWriter;

  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: EventEmitter2,
  ) {
    this.outbox = new PrismaOutboxWriter(this.prisma);
  }

  public async submit(input: SubmitPodInput) {
    if (!input.orderId && !input.rideId) {
      throw new BadRequestException('orderId or rideId is required');
    }
    if (input.orderId && input.rideId) {
      throw new BadRequestException('Provide only one of orderId or rideId');
    }

    let otpHash: string | null = null;
    let otpVerifiedAt: Date | null = null;
    if (input.otpCode?.trim()) {
      otpHash = createHash('sha256').update(input.otpCode.trim()).digest('hex');
      otpVerifiedAt = new Date();
    }

    const data: Prisma.ProofOfDeliveryCreateInput = {
      photoUrl: input.photoUrl?.trim() || null,
      signatureUrl: input.signatureUrl?.trim() || null,
      recipientName: input.recipientName?.trim() || null,
      notes: input.notes?.trim() || null,
      otpCodeHash: otpHash,
      otpVerifiedAt,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      confirmedBy: input.actorId,
      confirmedAt: new Date(),
      ...(input.orderId
        ? { order: { connect: { id: input.orderId } } }
        : {}),
      ...(input.rideId ? { ride: { connect: { id: input.rideId } } } : {}),
    };

    if (input.orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: input.orderId, deletedAt: null },
        include: { store: { include: { merchant: true } } },
      });
      if (!order) throw new NotFoundException('Order not found');
      await this.assertCanSubmitPod({
        actorId: input.actorId,
        customerId: order.customerId,
        riderId: order.riderId,
        merchantOwnerId: order.store.merchant.ownerUserId,
      });
    }
    if (input.rideId) {
      const ride = await this.prisma.ride.findFirst({
        where: { id: input.rideId, deletedAt: null },
      });
      if (!ride) throw new NotFoundException('Ride not found');
      await this.assertCanSubmitPod({
        actorId: input.actorId,
        customerId: ride.customerId,
        riderId: ride.riderId,
      });
    }

    const existing = await this.prisma.proofOfDelivery.findFirst({
      where: {
        ...(input.orderId ? { orderId: input.orderId } : {}),
        ...(input.rideId ? { rideId: input.rideId } : {}),
      },
    });

    const row = existing
      ? await this.prisma.proofOfDelivery.update({
          where: { id: existing.id },
          data: {
            photoUrl: data.photoUrl,
            signatureUrl: data.signatureUrl,
            recipientName: data.recipientName,
            notes: data.notes,
            otpCodeHash: otpHash,
            otpVerifiedAt,
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            confirmedBy: input.actorId,
            confirmedAt: new Date(),
          },
        })
      : await this.prisma.proofOfDelivery.create({ data });

    // Mirror onto ride legacy columns for backward-compatible clients.
    if (input.rideId) {
      await this.prisma.ride.update({
        where: { id: input.rideId },
        data: {
          podPhotoUrl: row.photoUrl,
          podSignatureUrl: row.signatureUrl,
          podNotes: row.notes,
        },
      });
    }

    await this.outbox.append({
      eventId: `pod-${row.id}-${Date.now()}`,
      aggregateId: row.id,
      eventName: 'ProofOfDeliverySubmitted',
      payload: {
        podId: row.id,
        orderId: row.orderId,
        rideId: row.rideId,
        confirmedBy: input.actorId,
      },
    });
    this.events.emit('logistics.ProofOfDeliverySubmitted', {
      podId: row.id,
      orderId: row.orderId,
      rideId: row.rideId,
      actorId: input.actorId,
    });
    await this.audit.record({
      tableName: 'proof_of_delivery',
      recordId: row.id,
      action: existing ? AuditAction.UPDATE : AuditAction.INSERT,
      actorId: input.actorId,
      actorType: input.actorType ?? ActorType.USER,
      afterData: {
        orderId: row.orderId,
        rideId: row.rideId,
        recipientName: row.recipientName,
      },
      reason: 'Proof of delivery submitted',
    });

    return { success: true as const, pod: this.toView(row) };
  }

  public async getForOrder(orderId: string, actorId: string, isAdmin: boolean) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { store: { include: { merchant: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (
      !isAdmin &&
      order.customerId !== actorId &&
      order.store.merchant.ownerUserId !== actorId
    ) {
      throw new ForbiddenException('Cannot view this proof of delivery');
    }
    const pod = await this.prisma.proofOfDelivery.findUnique({
      where: { orderId },
    });
    if (!pod) throw new NotFoundException('Proof of delivery not found');
    return { success: true as const, pod: this.toView(pod) };
  }

  public async getForRide(rideId: string, actorId: string, isAdmin: boolean) {
    const ride = await this.prisma.ride.findFirst({
      where: { id: rideId, deletedAt: null },
      include: { rider: true },
    });
    if (!ride) throw new NotFoundException('Ride not found');
    if (
      !isAdmin &&
      ride.customerId !== actorId &&
      ride.rider?.userId !== actorId
    ) {
      throw new ForbiddenException('Cannot view this proof of delivery');
    }
    const pod = await this.prisma.proofOfDelivery.findUnique({
      where: { rideId },
    });
    if (!pod) throw new NotFoundException('Proof of delivery not found');
    return { success: true as const, pod: this.toView(pod) };
  }

  /** Generate a one-time delivery OTP (returned once; hash stored). */
  public async issueOtp(input: {
    readonly orderId?: string;
    readonly rideId?: string;
    readonly actorId: string;
  }) {
    const code = String(randomBytes(3).readUIntBE(0, 3) % 1_000_000).padStart(
      6,
      '0',
    );
    const hash = createHash('sha256').update(code).digest('hex');
    await this.submit({
      ...input,
      actorId: input.actorId,
      otpCode: undefined,
      notes: undefined,
    }).catch(() => undefined);

    const where = input.orderId
      ? { orderId: input.orderId }
      : { rideId: input.rideId! };
    const existing = await this.prisma.proofOfDelivery.findFirst({ where });
    if (existing) {
      await this.prisma.proofOfDelivery.update({
        where: { id: existing.id },
        data: { otpCodeHash: hash, otpVerifiedAt: null },
      });
    } else {
      await this.prisma.proofOfDelivery.create({
        data: {
          ...where,
          otpCodeHash: hash,
          confirmedBy: input.actorId,
        },
      });
    }
    return { success: true as const, otp: code };
  }

  private async assertCanSubmitPod(input: {
    readonly actorId: string;
    readonly customerId: string;
    readonly riderId?: string | null;
    readonly merchantOwnerId?: string | null;
  }): Promise<void> {
    if (input.customerId === input.actorId) return;
    if (input.merchantOwnerId && input.merchantOwnerId === input.actorId) {
      return;
    }
    if (input.riderId) {
      const rider = await this.prisma.rider.findFirst({
        where: { id: input.riderId, deletedAt: null },
        select: { userId: true },
      });
      if (rider?.userId === input.actorId) return;
    }
    const admin = await this.prisma.userRole.findFirst({
      where: {
        userId: input.actorId,
        role: { code: { in: ['ADMIN', 'SUPPORT', 'FINANCE'] } },
      },
    });
    if (admin) return;
    throw new ForbiddenException('Cannot submit proof of delivery for this job');
  }

  private toView(row: {
    id: string;
    orderId: string | null;
    rideId: string | null;
    photoUrl: string | null;
    signatureUrl: string | null;
    recipientName: string | null;
    notes: string | null;
    otpVerifiedAt: Date | null;
    latitude: Prisma.Decimal | null;
    longitude: Prisma.Decimal | null;
    confirmedAt: Date;
    confirmedBy: string | null;
  }) {
    return {
      id: row.id,
      orderId: row.orderId,
      rideId: row.rideId,
      photoUrl: row.photoUrl,
      signatureUrl: row.signatureUrl,
      recipientName: row.recipientName,
      notes: row.notes,
      otpVerified: row.otpVerifiedAt != null,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      confirmedAt: row.confirmedAt.toISOString(),
      confirmedBy: row.confirmedBy,
    };
  }
}
