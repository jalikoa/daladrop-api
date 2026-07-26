import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ActorType,
  AuditAction,
  Prisma,
  RideServiceType,
  VehicleType,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PrismaOutboxWriter } from '../../../infrastructure/database/outbox/prisma-outbox.writer';
import { kes, kesToBigInt, type Money } from '../../../shared/money';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';
import { DeliveryQuoteService } from './delivery-quote.service';
import {
  RideEtaService,
  SurgePricingService,
} from './surge-eta.service';

export type QuoteType =
  | 'CHECKOUT'
  | 'FOOD'
  | 'MARKET'
  | 'GAS'
  | 'LIQUOR'
  | 'PARCEL'
  | 'TRANSPORT'
  | 'RIDE';

export interface PersistQuoteInput {
  readonly quoteType: QuoteType;
  readonly customerId?: string;
  readonly storeId?: string | null;
  readonly serviceType?: string | null;
  readonly subtotal?: Money;
  readonly basePrice: Money;
  readonly distanceFee?: Money;
  readonly deliveryFee: Money;
  readonly serviceFee: Money;
  readonly platformFee?: Money;
  readonly tax?: Money;
  readonly discount?: Money;
  readonly coupon?: Money;
  readonly walletCredit?: Money;
  readonly promotion?: Money;
  readonly surgeAmount?: Money;
  readonly peakAmount?: Money;
  readonly merchantEarnings: Money;
  readonly riderEarnings: Money;
  readonly platformRevenue: Money;
  readonly total: Money;
  readonly distanceKm?: number | null;
  readonly durationMinutes?: number | null;
  readonly etaMinutes?: number | null;
  readonly surgeMultiplier?: number | null;
  readonly deliveryPricingRuleId?: string | null;
  readonly breakdown?: Record<string, unknown>;
  readonly requestSnapshot?: Record<string, unknown>;
  readonly ttlMinutes?: number;
}

@Injectable()
export class QuoteEngineService {
  private readonly outbox: PrismaOutboxWriter;

  public constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryQuotes: DeliveryQuoteService,
    private readonly surge: SurgePricingService,
    private readonly eta: RideEtaService,
    private readonly audit: AuditLogService,
    private readonly events: EventEmitter2,
  ) {
    this.outbox = new PrismaOutboxWriter(this.prisma);
  }

  public async quoteCheckout(input: {
    readonly customerId?: string;
    readonly vendorType: string;
    readonly vendorId: string;
    readonly deliveryLat: number;
    readonly deliveryLng: number;
    readonly cylinderTypeId?: string | null;
    readonly subtotalAmount?: number;
    readonly couponCode?: string;
    readonly walletCreditKes?: number;
  }) {
    const result = await this.deliveryQuotes.quoteCheckout({
      vendorType: input.vendorType,
      vendorId: input.vendorId,
      deliveryLat: input.deliveryLat,
      deliveryLng: input.deliveryLng,
      cylinderTypeId: input.cylinderTypeId,
    });
    const serviceFee = await this.deliveryQuotes.resolveServiceFee();
    const surgeMultiplier = this.surge.resolveMultiplier();
    const deliveryFee = this.surge.apply(result.customerCharge, surgeMultiplier);
    const surgeAmount = kes(
      Math.max(0, deliveryFee.amount - result.customerCharge.amount),
    );
    const subtotal = kes(Math.max(0, Math.round(input.subtotalAmount ?? 0)));
    const coupon = kes(0);
    const walletCredit = kes(
      Math.max(0, Math.round(input.walletCreditKes ?? 0)),
    );
    const tax = kes(0);
    const platformFee = result.platformCommission;
    const totalBeforeCredits = kes(
      subtotal.amount + deliveryFee.amount + serviceFee.amount + tax.amount,
    );
    const total = kes(
      Math.max(0, totalBeforeCredits.amount - coupon.amount - walletCredit.amount),
    );
    const etaMinutes = this.eta.estimateMinutes(result.distanceKm);
    const quoteType = this.mapVendorQuoteType(input.vendorType);
    const hour = new Date().getHours();
    const isPeak = (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 21);
    const peakAmount = isPeak
      ? kes(Math.round(deliveryFee.amount * 0.05))
      : kes(0);
    const trafficFactor = Number(process.env.QUOTE_TRAFFIC_FACTOR ?? '1');
    const durationMinutes = Math.max(
      1,
      Math.round(etaMinutes * (Number.isFinite(trafficFactor) ? trafficFactor : 1)),
    );
    const totalWithPeak = kes(total.amount + peakAmount.amount);

    const persisted = await this.persist({
      quoteType,
      customerId: input.customerId,
      storeId: result.storeId,
      serviceType: result.serviceType,
      subtotal,
      basePrice: result.customerCharge,
      deliveryFee,
      serviceFee,
      platformFee,
      tax,
      coupon,
      walletCredit,
      surgeAmount,
      peakAmount,
      merchantEarnings: kes(
        Math.max(0, subtotal.amount - result.platformCommission.amount),
      ),
      riderEarnings: result.riderPay,
      platformRevenue: kes(
        result.platformCommission.amount + serviceFee.amount + peakAmount.amount,
      ),
      total: totalWithPeak,
      distanceKm: result.distanceKm,
      durationMinutes,
      etaMinutes: durationMinutes,
      surgeMultiplier,
      deliveryPricingRuleId: result.ruleId,
      breakdown: {
        constraintId: result.constraintId,
        suggestParcel: result.suggestParcel,
        maxDistanceKm: result.maxDistanceKm,
        couponCode: input.couponCode ?? null,
        trafficFactor,
        dynamicPricing: {
          surgeMultiplier,
          peak: isPeak,
          peakAmount: peakAmount.amount,
        },
      },
      requestSnapshot: {
        vendorType: input.vendorType,
        vendorId: input.vendorId,
        deliveryLat: input.deliveryLat,
        deliveryLng: input.deliveryLng,
        cylinderTypeId: input.cylinderTypeId ?? null,
      },
    });

    return this.toApiView(persisted);
  }

  public async quoteTransport(input: {
    readonly customerId?: string;
    readonly serviceType: string;
    readonly pickupLat: number;
    readonly pickupLng: number;
    readonly dropoffLat: number;
    readonly dropoffLng: number;
    readonly vehicleType?: string;
    readonly routeId?: string;
    readonly weightCategory?: string;
  }) {
    const serviceType = this.toRideServiceType(input.serviceType);
    const vehicleType = this.toVehicleType(input.vehicleType);
    const fare = await this.deliveryQuotes.quotePointToPoint({
      serviceType,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      vehicleType,
      routeId: input.routeId,
      weightCategory: input.weightCategory,
    });
    const surgeMultiplier = this.surge.resolveMultiplier();
    const customerCharge = this.surge.apply(fare.customerCharge, surgeMultiplier);
    const surgeAmount = kes(
      Math.max(0, customerCharge.amount - fare.customerCharge.amount),
    );
    const etaMinutes = this.eta.estimateMinutes(fare.distanceKm);
    const hour = new Date().getHours();
    const isPeak = (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 21);
    const peakAmount = isPeak
      ? kes(Math.round(customerCharge.amount * 0.05))
      : kes(0);
    const trafficFactor = Number(process.env.QUOTE_TRAFFIC_FACTOR ?? '1');
    const durationMinutes = Math.max(
      1,
      Math.round(etaMinutes * (Number.isFinite(trafficFactor) ? trafficFactor : 1)),
    );
    const serviceFee = kes(0);
    const total = kes(customerCharge.amount + peakAmount.amount);
    const persisted = await this.persist({
      quoteType: serviceType === RideServiceType.PARCEL ? 'PARCEL' : 'TRANSPORT',
      customerId: input.customerId,
      serviceType,
      basePrice: fare.customerCharge,
      deliveryFee: customerCharge,
      serviceFee,
      platformFee: fare.platformCommission,
      surgeAmount,
      peakAmount,
      merchantEarnings: kes(0),
      riderEarnings: fare.riderPay,
      platformRevenue: kes(
        fare.platformCommission.amount + peakAmount.amount,
      ),
      total,
      distanceKm: fare.distanceKm,
      durationMinutes,
      etaMinutes: durationMinutes,
      surgeMultiplier,
      deliveryPricingRuleId: fare.ruleId,
      breakdown: {
        weightSurcharge: fare.weightSurcharge.amount,
        interCountyRouteId: fare.interCountyRouteId,
        trafficFactor,
        dynamicPricing: {
          surgeMultiplier,
          peak: isPeak,
          peakAmount: peakAmount.amount,
        },
      },
      requestSnapshot: { ...input },
    });
    return this.toApiView(persisted);
  }

  public async requireUsable(
    quoteId: string,
    customerId?: string,
    expected?: {
      readonly storeId?: string;
      readonly deliveryLat?: number;
      readonly deliveryLng?: number;
      readonly pickupLat?: number;
      readonly pickupLng?: number;
      readonly dropoffLat?: number;
      readonly dropoffLng?: number;
      readonly serviceType?: string;
    },
  ) {
    const quote = await this.prisma.pricingQuote.findUnique({
      where: { id: quoteId },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.consumedAt) {
      throw new BadRequestException('Quote has already been used');
    }
    if (quote.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Quote has expired');
    }
    // Anonymous quotes cannot be consumed by authenticated customers —
    // the quote must be bound to the same principal that will pay.
    if (customerId) {
      if (!quote.customerId || quote.customerId !== customerId) {
        throw new BadRequestException('Quote does not belong to this customer');
      }
    }
    if (expected) {
      this.assertQuoteMatchesRequest(quote, expected);
    }
    return quote;
  }

  /**
   * Ensures a persisted quote's request snapshot matches the ride/order being
   * priced — prevents underpayment by swapping a cheap quote onto a far trip.
   */
  public assertQuoteMatchesRequest(
    quote: {
      readonly storeId: string | null;
      readonly serviceType: string | null;
      readonly requestSnapshot: unknown;
    },
    expected: {
      readonly storeId?: string;
      readonly deliveryLat?: number;
      readonly deliveryLng?: number;
      readonly pickupLat?: number;
      readonly pickupLng?: number;
      readonly dropoffLat?: number;
      readonly dropoffLng?: number;
      readonly serviceType?: string;
    },
  ): void {
    const snap =
      quote.requestSnapshot && typeof quote.requestSnapshot === 'object'
        ? (quote.requestSnapshot as Record<string, unknown>)
        : {};

    if (expected.storeId && quote.storeId && quote.storeId !== expected.storeId) {
      throw new BadRequestException('Quote does not match this vendor');
    }
    if (
      expected.serviceType &&
      quote.serviceType &&
      quote.serviceType !== expected.serviceType
    ) {
      throw new BadRequestException('Quote service type does not match');
    }

    this.assertCoordClose(
      snap.deliveryLat ?? snap.deliveryLatitude,
      expected.deliveryLat,
      'delivery',
    );
    this.assertCoordClose(
      snap.deliveryLng ?? snap.deliveryLongitude,
      expected.deliveryLng,
      'delivery',
    );
    this.assertCoordClose(
      snap.pickupLat ?? snap.pickupLatitude,
      expected.pickupLat,
      'pickup',
    );
    this.assertCoordClose(
      snap.pickupLng ?? snap.pickupLongitude,
      expected.pickupLng,
      'pickup',
    );
    this.assertCoordClose(
      snap.dropoffLat ?? snap.dropoffLatitude,
      expected.dropoffLat,
      'dropoff',
    );
    this.assertCoordClose(
      snap.dropoffLng ?? snap.dropoffLongitude,
      expected.dropoffLng,
      'dropoff',
    );
  }

  private assertCoordClose(
    quoted: unknown,
    actual: number | undefined,
    label: string,
  ): void {
    if (actual == null || quoted == null) return;
    const q = Number(quoted);
    if (!Number.isFinite(q)) return;
    // ~110 m at equator — enough for GPS jitter, tight enough to block fare swaps.
    const COORD_TOLERANCE_DEG = 0.001;
    if (Math.abs(q - actual) > COORD_TOLERANCE_DEG) {
      throw new BadRequestException(
        `Quote ${label} coordinates do not match the request`,
      );
    }
  }

  public async markConsumed(quoteId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.pricingQuote.update({
      where: { id: quoteId },
      data: { consumedAt: new Date() },
    });
  }

  private async persist(input: PersistQuoteInput) {
    const ttl = input.ttlMinutes ?? 15;
    const expiresAt = new Date(Date.now() + ttl * 60_000);
    const estimatedCompletionAt =
      input.etaMinutes != null
        ? new Date(Date.now() + input.etaMinutes * 60_000)
        : null;
    const row = await this.prisma.pricingQuote.create({
      data: {
        quoteType: input.quoteType,
        customerId: input.customerId ?? null,
        storeId: input.storeId ?? null,
        serviceType: input.serviceType ?? null,
        subtotalAmount: kesToBigInt(input.subtotal ?? kes(0)),
        basePriceAmount: kesToBigInt(input.basePrice),
        distanceFeeAmount: kesToBigInt(input.distanceFee ?? kes(0)),
        deliveryFeeAmount: kesToBigInt(input.deliveryFee),
        serviceFeeAmount: kesToBigInt(input.serviceFee),
        platformFeeAmount: kesToBigInt(input.platformFee ?? kes(0)),
        taxAmount: kesToBigInt(input.tax ?? kes(0)),
        discountAmount: kesToBigInt(input.discount ?? kes(0)),
        couponAmount: kesToBigInt(input.coupon ?? kes(0)),
        walletCreditAmount: kesToBigInt(input.walletCredit ?? kes(0)),
        promotionAmount: kesToBigInt(input.promotion ?? kes(0)),
        surgeAmount: kesToBigInt(input.surgeAmount ?? kes(0)),
        peakAmount: kesToBigInt(input.peakAmount ?? kes(0)),
        totalAmount: kesToBigInt(input.total),
        merchantEarningsAmount: kesToBigInt(input.merchantEarnings),
        riderEarningsAmount: kesToBigInt(input.riderEarnings),
        platformRevenueAmount: kesToBigInt(input.platformRevenue),
        distanceKm: input.distanceKm ?? null,
        durationMinutes: input.durationMinutes ?? null,
        etaMinutes: input.etaMinutes ?? null,
        estimatedCompletionAt,
        surgeMultiplier: input.surgeMultiplier ?? null,
        deliveryPricingRuleId: input.deliveryPricingRuleId ?? null,
        breakdown: (input.breakdown ?? {}) as Prisma.InputJsonValue,
        requestSnapshot: (input.requestSnapshot ?? {}) as Prisma.InputJsonValue,
        expiresAt,
      },
    });

    await this.outbox.append({
      eventId: `quote-${row.id}`,
      aggregateId: row.id,
      eventName: 'QuoteGenerated',
      payload: {
        quoteId: row.id,
        quoteType: row.quoteType,
        totalAmount: Number(row.totalAmount),
        currency: row.currency,
      },
    });
    this.events.emit('pricing.QuoteGenerated', {
      quoteId: row.id,
      quoteType: row.quoteType,
      customerId: row.customerId,
      totalAmount: Number(row.totalAmount),
    });
    await this.audit.record({
      tableName: 'pricing_quotes',
      recordId: row.id,
      action: AuditAction.INSERT,
      actorType: ActorType.SYSTEM,
      afterData: { quoteType: row.quoteType, total: Number(row.totalAmount) },
      reason: 'Pricing quote persisted',
    });
    return row;
  }

  private toRideServiceType(value: string): RideServiceType {
    const key = value.trim().toUpperCase();
    if ((Object.values(RideServiceType) as string[]).includes(key)) {
      return key as RideServiceType;
    }
    throw new BadRequestException(`Unknown ride service type: ${value}`);
  }

  private toVehicleType(value?: string): VehicleType | undefined {
    if (!value) return undefined;
    const key = value.trim().toUpperCase();
    return (Object.values(VehicleType) as string[]).includes(key)
      ? (key as VehicleType)
      : undefined;
  }

  private toApiView(row: {
    id: string;
    quoteType: string;
    currency: string;
    subtotalAmount: bigint;
    basePriceAmount: bigint;
    deliveryFeeAmount: bigint;
    serviceFeeAmount: bigint;
    platformFeeAmount: bigint;
    taxAmount: bigint;
    discountAmount: bigint;
    couponAmount: bigint;
    walletCreditAmount: bigint;
    promotionAmount: bigint;
    surgeAmount: bigint;
    peakAmount: bigint;
    totalAmount: bigint;
    merchantEarningsAmount: bigint;
    riderEarningsAmount: bigint;
    platformRevenueAmount: bigint;
    distanceKm: Prisma.Decimal | null;
    durationMinutes: number | null;
    etaMinutes: number | null;
    estimatedCompletionAt: Date | null;
    surgeMultiplier: Prisma.Decimal | null;
    deliveryPricingRuleId: string | null;
    breakdown: unknown;
    expiresAt: Date;
  }) {
    return {
      success: true as const,
      quoteId: row.id,
      quoteType: row.quoteType,
      currency: row.currency,
      expiresAt: row.expiresAt.toISOString(),
      distanceKm: row.distanceKm != null ? Number(row.distanceKm) : null,
      durationMinutes: row.durationMinutes,
      etaMinutes: row.etaMinutes,
      estimatedCompletionAt: row.estimatedCompletionAt?.toISOString() ?? null,
      surgeMultiplier:
        row.surgeMultiplier != null ? Number(row.surgeMultiplier) : null,
      ruleId: row.deliveryPricingRuleId,
      // Compatibility aliases for existing checkout clients
      deliveryFee: Number(row.deliveryFeeAmount),
      serviceFee: Number(row.serviceFeeAmount),
      fare: Number(row.totalAmount),
      amounts: {
        subtotal: Number(row.subtotalAmount),
        basePrice: Number(row.basePriceAmount),
        distanceFee: Number(row.deliveryFeeAmount),
        durationFee: 0,
        surge: Number(row.surgeAmount),
        peak: Number(row.peakAmount),
        platformFee: Number(row.platformFeeAmount),
        serviceFee: Number(row.serviceFeeAmount),
        tax: Number(row.taxAmount),
        discount: Number(row.discountAmount),
        coupon: Number(row.couponAmount),
        walletCredit: Number(row.walletCreditAmount),
        promotion: Number(row.promotionAmount),
        deliveryFee: Number(row.deliveryFeeAmount),
        total: Number(row.totalAmount),
      },
      earnings: {
        merchant: Number(row.merchantEarningsAmount),
        rider: Number(row.riderEarningsAmount),
        platform: Number(row.platformRevenueAmount),
      },
      breakdown: row.breakdown,
    };
  }

  private mapVendorQuoteType(vendorType: string): QuoteType {
    const key = vendorType.trim().toLowerCase();
    if (key === 'restaurant' || key === 'food') return 'FOOD';
    if (key === 'market' || key === 'local_market') return 'MARKET';
    if (key === 'gas' || key === 'gas_delivery') return 'GAS';
    if (key === 'liquor' || key === 'liquor_store') return 'LIQUOR';
    if (key === 'parcel') return 'PARCEL';
    return 'CHECKOUT';
  }
}

/** Hash helper for POD OTP verification. */
export function hashPodOtp(code: string): string {
  return createHash('sha256').update(code.trim()).digest('hex');
}

export function newEventId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
