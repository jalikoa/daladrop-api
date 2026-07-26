import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ActorType,
  AuditAction,
  PaymentStatus,
  Prisma,
  ReviewTargetType,
  Ride,
  RideServiceType,
  RideStatus,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { kes, kesToBigInt } from '../../../shared/money';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';
import { PaymentsService } from '../../payments/use-cases/payments.service';
import {
  rideStatusAlias,
  toUiRideStatus,
} from '../domain/ride-status.mapper';
import { toParcelWeightCategory } from '../domain/weight-category.mapper';
import type {
  CreateRideDto,
  PayRideDto,
  RateRideDto,
  RideQuoteDto,
} from '../dto/transport.dto';
import { RideProviderResolver } from '../listeners/ride-provider.resolver';
import { RideDispatchService } from './ride-dispatch.service';
import { RidersDiscoveryService } from './riders-discovery.service';
import { RideQuoteService } from './ride-quote.service';
import { QuoteEngineService } from '../../logistics/use-cases/quote-engine.service';

const RIDES_TABLE = 'rides';
const DEFAULT_REQUEST_RADIUS_KM = 5;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TERMINAL_RIDE_STATUSES: readonly RideStatus[] = [
  RideStatus.COMPLETED,
  RideStatus.CANCELLED,
  RideStatus.FAILED,
];
const UNPAID_CANCELLABLE_RIDE_STATUSES: readonly RideStatus[] = [
  RideStatus.PENDING_PAYMENT,
  RideStatus.SEARCHING,
];

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: EventEmitter2,
    private readonly payments: PaymentsService,
    private readonly quoteService: RideQuoteService,
    private readonly quoteEngine: QuoteEngineService,
    private readonly providerResolver: RideProviderResolver,
    private readonly ridersDiscovery: RidersDiscoveryService,
    private readonly config: ConfigService,
    private readonly dispatch: RideDispatchService,
  ) {}

  public async quote(input: RideQuoteDto, customerId?: string) {
    return this.quoteService.quote({ ...input, customerId });
  }

  public async createAndPay(userId: string, input: CreateRideDto) {
    if (!input.mpesaPhone) {
      throw new BadRequestException(
        'mpesaPhone is required for create-and-pay',
      );
    }
    const mpesaPhone = input.mpesaPhone;
    const ride = await this.createRideRow(
      userId,
      input,
      RideStatus.PENDING_PAYMENT,
    );
    return this.pay(ride.id, userId, { mpesaPhone });
  }

  public async request(userId: string, input: CreateRideDto) {
    this.quoteService.assertCoords(input);
    const nearby = await this.ridersDiscovery.nearby(
      input.pickupLat,
      input.pickupLng,
      DEFAULT_REQUEST_RADIUS_KM,
    );
    if (nearby.riders.length === 0) {
      return { success: false as const, noRiders: true as const };
    }

    const ride = await this.createRideRow(
      userId,
      { ...input, serviceType: RideServiceType.RIDE },
      RideStatus.SEARCHING,
    );

    try {
      await this.dispatch.autoAssignNearest(ride.id);
    } catch (error) {
      this.logger.warn(
        `Auto-assign failed for ride ${ride.id}: ${String(error)}`,
      );
    }

    const view = await this.getRide(ride.id, userId);
    return { success: true as const, rideId: ride.id, ...view };
  }

  public async pay(rideId: string, userId: string, input: PayRideDto) {
    const ride = await this.requireOwnedRide(rideId, userId);

    if (ride.paymentStatus === PaymentStatus.SUCCESS) {
      const view = await this.getRide(rideId, userId);
      return {
        success: true as const,
        rideId,
        mpesa: { initiated: false },
        checkoutRequestId: null,
        ...view,
      };
    }
    if (TERMINAL_RIDE_STATUSES.includes(ride.status)) {
      throw new ConflictException(`Ride cannot be paid while ${ride.status}`);
    }

    const phone = this.providerResolver.requirePhone(input.mpesaPhone);
    const providerCode = this.providerResolver.resolveProviderCode();
    const payment = await this.payments.createAndInitiate({
      customerId: userId,
      amount: ride.fareAmount,
      currency: ride.currency,
      purpose: 'RIDE',
      providerCode,
      payerIdentifier: phone,
      description: `Ride ${rideId}`,
      idempotencyKey: `ride-pay:${rideId}:${providerCode}`,
      rideId,
      metadata: { source: 'transport.rides.pay', rideId },
    });

    const initiated =
      providerCode !== 'MANUAL' &&
      Boolean(payment.checkoutRequestId) &&
      payment.status !== 'FAILED';

    if (providerCode !== 'MANUAL' && !initiated) {
      throw new BadRequestException(
        payment.failureMessage ?? 'Payment provider did not initiate STK',
      );
    }

    await this.prisma.ride.update({
      where: { id: rideId },
      data: { paymentStatus: PaymentStatus.PROCESSING },
    });

    await this.audit.record({
      tableName: RIDES_TABLE,
      recordId: rideId,
      action: AuditAction.STATUS_CHANGE,
      actorId: userId,
      actorType: ActorType.USER,
      afterData: {
        paymentId: payment.id,
        paymentStatus: PaymentStatus.PROCESSING,
        providerCode,
        checkoutRequestId: payment.checkoutRequestId ?? null,
      },
      reason: 'Ride payment requested',
    });

    this.events.emit('transport.ride.payment_requested', {
      rideId,
      paymentId: payment.id,
      customerId: userId,
      checkoutRequestId: payment.checkoutRequestId ?? null,
    });

    const view = await this.getRide(rideId, userId);
    return {
      success: true as const,
      rideId,
      paymentId: payment.id,
      mpesa: { initiated },
      checkoutRequestId: payment.checkoutRequestId ?? null,
      ...view,
    };
  }

  public async retryPayment(rideId: string, userId: string) {
    const ride = await this.requireOwnedRide(rideId, userId);
    if (ride.paymentStatus === PaymentStatus.SUCCESS) {
      throw new ConflictException('Ride is already paid');
    }
    if (TERMINAL_RIDE_STATUSES.includes(ride.status)) {
      throw new ConflictException(
        `Ride cannot be paid while ${ride.status}`,
      );
    }

    const lastPayment = await this.prisma.payment.findFirst({
      where: { rideId, purpose: 'RIDE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!lastPayment) {
      throw new BadRequestException(
        'No prior payment attempt to retry; call pay instead',
      );
    }

    const idempotencyKey = `ride-retry:${rideId}:${randomUUID()}`;
    await this.payments.retry(lastPayment.id, userId, idempotencyKey);

    const providerTx = await this.prisma.paymentProviderTransaction.findFirst({
      where: { paymentId: lastPayment.id },
      orderBy: { createdAt: 'desc' },
    });
    const checkoutRequestId =
      providerTx?.checkoutRequestId ?? providerTx?.providerReference ?? null;
    const initiated =
      Boolean(checkoutRequestId) &&
      providerTx?.status !== PaymentStatus.FAILED;

    if (!initiated) {
      throw new BadRequestException('Payment provider did not initiate STK');
    }

    await this.prisma.ride.update({
      where: { id: rideId },
      data: { paymentStatus: PaymentStatus.PROCESSING },
    });

    const view = await this.getRide(rideId, userId);
    return {
      success: true as const,
      rideId,
      mpesa: { initiated },
      checkoutRequestId,
      ...view,
    };
  }

  public async cancelUnpaid(rideId: string, userId: string) {
    const ride = await this.requireOwnedRide(rideId, userId);
    if (ride.paymentStatus === PaymentStatus.SUCCESS) {
      throw new ConflictException(
        'Ride is already paid; use the cancel endpoint instead',
      );
    }
    if (!UNPAID_CANCELLABLE_RIDE_STATUSES.includes(ride.status)) {
      throw new ConflictException(
        `Ride cannot be cancelled while ${ride.status}`,
      );
    }

    await this.transitionStatus(
      ride,
      RideStatus.CANCELLED,
      userId,
      'Unpaid ride cancelled by customer',
      { cancelledAt: new Date(), cancelReason: 'Cancelled before payment' },
    );

    const view = await this.getRide(rideId, userId);
    return { success: true as const, rideId, ...view };
  }

  public async cancel(rideId: string, userId: string, reason?: string) {
    const ride = await this.requireOwnedRide(rideId, userId);
    if (TERMINAL_RIDE_STATUSES.includes(ride.status)) {
      throw new ConflictException(
        `Ride cannot be cancelled while ${ride.status}`,
      );
    }

    await this.transitionStatus(
      ride,
      RideStatus.CANCELLED,
      userId,
      reason ?? 'Cancelled by customer',
      { cancelledAt: new Date(), cancelReason: reason ?? null },
    );

    const view = await this.getRide(rideId, userId);
    return { success: true as const, rideId, ...view };
  }

  public async getRide(rideId: string, userId: string) {
    const ride = await this.prisma.ride.findFirst({
      where: { id: rideId, deletedAt: null },
    });
    if (!ride) throw new NotFoundException('Ride not found');
    if (ride.customerId !== userId) {
      throw new ForbiddenException('Cannot access another user ride');
    }
    const view = this.toRideView(ride);
    return { ...view, ride: view };
  }

  /** Admin / internal lookup — ownership is not enforced. */
  public async getRideAdmin(rideId: string) {
    const ride = await this.prisma.ride.findFirst({
      where: { id: rideId, deletedAt: null },
    });
    if (!ride) throw new NotFoundException('Ride not found');
    const view = this.toRideView(ride);
    return { ...view, ride: view };
  }

  public async share(rideId: string, userId: string) {
    const ride = await this.requireOwnedRide(rideId, userId);
    let token = ride.shareToken;
    if (!token) {
      token = randomUUID().replace(/-/g, '').slice(0, 16);
      await this.prisma.ride.update({
        where: { id: rideId },
        data: { shareToken: token },
      });
    }
    const base = this.config.get<string>('PUBLIC_APP_URL') ?? '';
    const shareUrl = `${base}/tracking?rideId=${rideId}&token=${token}`;
    return { success: true as const, token, shareUrl };
  }

  public async rate(rideId: string, userId: string, input: RateRideDto) {
    const ride = await this.requireOwnedRide(rideId, userId);
    if (ride.status !== RideStatus.COMPLETED) {
      throw new BadRequestException('Ride must be completed before rating');
    }
    if (!ride.riderId) {
      throw new BadRequestException('Ride has no assigned rider to rate');
    }

    const existing = await this.prisma.review.findFirst({
      where: { rideId, authorId: userId, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Ride has already been rated');
    }

    const score = input.score ?? input.rating;
    if (score == null) {
      throw new BadRequestException('score is required');
    }

    const review = await this.prisma.review.create({
      data: {
        authorId: userId,
        targetType: ReviewTargetType.RIDER,
        riderId: ride.riderId,
        rideId,
        score,
        comment: input.comment ?? null,
        tags: input.tags ?? [],
      },
    });

    await this.updateRiderRatingAggregate(ride.riderId);

    return { success: true as const, reviewId: review.id };
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private async createRideRow(
    userId: string,
    input: CreateRideDto,
    initialStatus: RideStatus,
  ): Promise<Ride> {
    let pricingQuoteId: string | null = null;
    let fare = await this.quoteService.computeFare({
      serviceType: input.serviceType,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      vehicleType: input.vehicleType,
      routeId: input.routeId,
      weightCategory: input.weightCategory,
    });

    if (input.quoteId) {
      const quote = await this.quoteEngine.requireUsable(input.quoteId, userId, {
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        dropoffLat: input.dropoffLat,
        dropoffLng: input.dropoffLng,
        serviceType: input.serviceType,
      });
      pricingQuoteId = quote.id;
      // Prefer persisted quote amounts (server truth); still recompute distance metadata.
      fare = {
        ...fare,
        customerCharge: kes(Number(quote.totalAmount)),
        riderPay: kes(Number(quote.riderEarningsAmount)),
        platformCommission: kes(Number(quote.platformRevenueAmount)),
        surgeMultiplier:
          quote.surgeMultiplier != null
            ? Number(quote.surgeMultiplier)
            : fare.surgeMultiplier,
        etaMinutes: quote.etaMinutes ?? fare.etaMinutes,
        deliveryPricingRuleId:
          quote.deliveryPricingRuleId ?? fare.deliveryPricingRuleId,
      };
      await this.prisma.pricingQuote.update({
        where: { id: quote.id },
        data: { consumedAt: new Date() },
      });
    }

    const weightCategory = toParcelWeightCategory(input.weightCategory);
    const courierPartnerId = await this.resolveCourierPartnerId(
      input.partnerId,
      input.businessPartner,
    );

    const ride = await this.prisma.ride.create({
      data: {
        customerId: userId,
        serviceType: input.serviceType,
        status: initialStatus,
        vehicleType: input.vehicleType ?? 'BIKE',
        pickupAddress: input.pickupAddress ?? null,
        pickupLatitude: input.pickupLat,
        pickupLongitude: input.pickupLng,
        dropoffAddress: input.dropoffAddress ?? null,
        dropoffLatitude: input.dropoffLat,
        dropoffLongitude: input.dropoffLng,
        fareAmount: kesToBigInt(fare.customerCharge),
        currency: fare.currency,
        distanceKm: fare.distanceKm,
        deliveryPricingRuleId: fare.deliveryPricingRuleId,
        riderPayAmount: kesToBigInt(fare.riderPay),
        platformCommissionAmount: kesToBigInt(fare.platformCommission),
        paymentStatus: PaymentStatus.PENDING,
        itemDescription: input.itemDescription ?? null,
        receiverPhone: input.receiverPhone ?? null,
        weightCategory,
        parcelSize: input.parcelSize ?? null,
        courierPartnerId,
        interCountyRouteId: fare.interCountyRouteId,
        etaMinutes: fare.etaMinutes,
        surgeMultiplier: fare.surgeMultiplier,
        pricingQuoteId,
      },
    });

    await this.recordHistory(ride.id, null, initialStatus, userId, 'Ride created');

    await this.audit.record({
      tableName: RIDES_TABLE,
      recordId: ride.id,
      action: AuditAction.INSERT,
      actorId: userId,
      actorType: ActorType.USER,
      afterData: {
        status: ride.status,
        serviceType: ride.serviceType,
        fareAmount: ride.fareAmount.toString(),
      },
      reason: 'Ride created',
    });

    this.events.emit('transport.ride.created', {
      rideId: ride.id,
      customerId: userId,
      serviceType: ride.serviceType,
      status: ride.status,
    });

    return ride;
  }

  /**
   * `partnerId` (Phase 14 alias) may be either a `CourierPartner.id` or a
   * display name — try the id lookup first (guarded by a UUID shape check
   * so non-UUID strings don't hit Postgres), then fall back to name
   * resolution shared with the legacy `businessPartner` field.
   */
  private async resolveCourierPartnerId(
    partnerId?: string,
    businessPartner?: string,
  ): Promise<string | null> {
    if (partnerId) {
      if (UUID_PATTERN.test(partnerId)) {
        const byId = await this.prisma.courierPartner.findFirst({
          where: { id: partnerId, isActive: true, deletedAt: null },
        });
        if (byId) return byId.id;
      }
      const byName = await this.resolveCourierPartner(partnerId);
      if (byName) return byName;
    }
    if (businessPartner) {
      return this.resolveCourierPartner(businessPartner);
    }
    return null;
  }

  private async resolveCourierPartner(name: string): Promise<string | null> {
    const exact = await this.prisma.courierPartner.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        isActive: true,
        deletedAt: null,
      },
    });
    if (exact) return exact.id;

    const fuzzy = await this.prisma.courierPartner.findFirst({
      where: {
        name: { contains: name, mode: 'insensitive' },
        isActive: true,
        deletedAt: null,
      },
    });
    return fuzzy?.id ?? null;
  }

  private async requireOwnedRide(rideId: string, userId: string): Promise<Ride> {
    const ride = await this.prisma.ride.findFirst({
      where: { id: rideId, deletedAt: null },
    });
    if (!ride) throw new NotFoundException('Ride not found');
    if (ride.customerId !== userId) {
      throw new ForbiddenException('Cannot access another user ride');
    }
    return ride;
  }

  private async recordHistory(
    rideId: string,
    fromStatus: RideStatus | null,
    toStatus: RideStatus,
    actorId: string | null,
    reason: string,
  ): Promise<void> {
    await this.prisma.rideStatusHistory.create({
      data: {
        rideId,
        fromStatus,
        toStatus,
        actorType: actorId ? ActorType.USER : ActorType.SYSTEM,
        actorId,
        reason,
      },
    });
  }

  private async transitionStatus(
    ride: Ride,
    toStatus: RideStatus,
    actorId: string,
    reason: string,
    extraData: Prisma.RideUpdateInput = {},
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.ride.update({
        where: { id: ride.id },
        data: { status: toStatus, ...extraData },
      });
      await tx.rideStatusHistory.create({
        data: {
          rideId: ride.id,
          fromStatus: ride.status,
          toStatus,
          actorType: ActorType.USER,
          actorId,
          reason,
        },
      });
    });

    // Consumed by notifications module listeners to write in-app
    // RIDE_STATUS / RIDE_COMPLETED notifications without coupling transport
    // to notification concerns.
    this.events.emit('transport.ride.status_changed', {
      rideId: ride.id,
      customerId: ride.customerId,
      fromStatus: ride.status,
      toStatus,
      reason,
    });
  }

  private async updateRiderRatingAggregate(riderId: string): Promise<void> {
    const aggregate = await this.prisma.review.aggregate({
      where: { riderId, targetType: ReviewTargetType.RIDER, deletedAt: null },
      _avg: { score: true },
      _count: { score: true },
    });
    await this.prisma.rider.update({
      where: { id: riderId },
      data: {
        ratingAvg: aggregate._avg.score ?? 0,
        reviewCount: aggregate._count.score ?? 0,
      },
    });
  }

  private toRideView(ride: Ride) {
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
      shareToken: ride.shareToken,
      cancelReason: ride.cancelReason,
      createdAt: ride.createdAt.toISOString(),
      updatedAt: ride.updatedAt.toISOString(),
      assignedAt: ride.assignedAt ? ride.assignedAt.toISOString() : null,
      startedAt: ride.startedAt ? ride.startedAt.toISOString() : null,
      completedAt: ride.completedAt ? ride.completedAt.toISOString() : null,
      cancelledAt: ride.cancelledAt ? ride.cancelledAt.toISOString() : null,
    };
  }
}
