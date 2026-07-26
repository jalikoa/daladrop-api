import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LogisticsServiceType,
  RideServiceType,
  StoreType,
  VehicleType,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { kes, kesFromBigInt, kesToBigInt, kesZero, type Money } from '../../../shared/money';
import { haversineKm, toNumber } from '../domain/geo.util';
import {
  selectDeliveryPricingRule,
  toPricingRuleCandidate,
} from '../domain/pricing-selection';

export interface DeliveryQuoteResult {
  readonly customerCharge: Money;
  readonly riderPay: Money;
  readonly platformCommission: Money;
  readonly ruleId: string;
  readonly constraintId: string;
  readonly distanceKm: number;
  readonly serviceType: LogisticsServiceType;
  readonly maxDistanceKm: number;
  readonly suggestParcel: boolean;
}

export interface PointToPointQuoteResult {
  readonly customerCharge: Money;
  readonly riderPay: Money;
  readonly platformCommission: Money;
  /** Selected `DeliveryPricingRule.id`; `null` for inter-county route fares. */
  readonly ruleId: string | null;
  readonly distanceKm: number;
  /** `null` when the fare came from an `InterCountyRoute` instead of a distance band. */
  readonly logisticsServiceType: LogisticsServiceType | null;
  readonly interCountyRouteId: string | null;
  /** Weight surcharge (already folded into `customerCharge`/`riderPay`), for display. */
  readonly weightSurcharge: Money;
}

const DEFAULT_SERVICE_FEE_KES = 14;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class DeliveryQuoteService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  public async resolveServiceFee(): Promise<Money> {
    const active = await this.prisma.appPricingConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (active?.payload && typeof active.payload === 'object') {
      const payload = active.payload as Record<string, unknown>;
      const fee = payload.serviceFee;
      if (typeof fee === 'number' && Number.isFinite(fee) && fee >= 0) {
        return kes(Math.trunc(fee));
      }
    }
    const fromEnv = this.config.get<string>('CHECKOUT_SERVICE_FEE_KES');
    const parsed = fromEnv != null ? Number(fromEnv) : NaN;
    if (Number.isFinite(parsed) && parsed >= 0) {
      return kes(Math.trunc(parsed));
    }
    return kes(DEFAULT_SERVICE_FEE_KES);
  }

  public async quoteNormalDelivery(input: {
    readonly storeId: string;
    readonly deliveryLat: number;
    readonly deliveryLng: number;
  }): Promise<DeliveryQuoteResult> {
    return this.quoteForStore({
      ...input,
      serviceType: LogisticsServiceType.NORMAL_DELIVERY,
    });
  }

  public async quoteGasDelivery(input: {
    readonly storeId: string;
    readonly deliveryLat: number;
    readonly deliveryLng: number;
    readonly cylinderTypeId: string;
  }): Promise<DeliveryQuoteResult> {
    return this.quoteForStore({
      storeId: input.storeId,
      deliveryLat: input.deliveryLat,
      deliveryLng: input.deliveryLng,
      serviceType: LogisticsServiceType.GAS_DELIVERY,
      cylinderTypeId: input.cylinderTypeId,
    });
  }

  public async quoteCheckout(input: {
    readonly vendorType: string;
    readonly vendorId: string;
    readonly deliveryLat: number;
    readonly deliveryLng: number;
    readonly cylinderTypeId?: string | null;
  }): Promise<DeliveryQuoteResult & { readonly storeId: string }> {
    const storeType = this.mapVendorType(input.vendorType);
    const store = await this.prisma.store.findFirst({
      where: {
        id: input.vendorId,
        storeType,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!store) throw new NotFoundException('Vendor store not found');

    const isGas = storeType === StoreType.GAS;
    const quote = await this.quoteForStore({
      storeId: store.id,
      deliveryLat: input.deliveryLat,
      deliveryLng: input.deliveryLng,
      serviceType: isGas
        ? LogisticsServiceType.GAS_DELIVERY
        : LogisticsServiceType.NORMAL_DELIVERY,
      cylinderTypeId: isGas ? input.cylinderTypeId ?? null : null,
    });
    return { ...quote, storeId: store.id };
  }

  private async quoteForStore(input: {
    readonly storeId: string;
    readonly deliveryLat: number;
    readonly deliveryLng: number;
    readonly serviceType: LogisticsServiceType;
    readonly cylinderTypeId?: string | null;
  }): Promise<DeliveryQuoteResult> {
    const store = await this.prisma.store.findFirst({
      where: { id: input.storeId, deletedAt: null },
    });
    if (!store) throw new NotFoundException('Store not found');

    const storeLat = toNumber(store.latitude);
    const storeLng = toNumber(store.longitude);
    if (storeLat == null || storeLng == null) {
      throw new BadRequestException('Store location is not configured');
    }

    const distanceKm =
      Math.round(
        haversineKm(
          storeLat,
          storeLng,
          input.deliveryLat,
          input.deliveryLng,
        ) * 1000,
      ) / 1000;

    const now = new Date();
    const constraint = await this.prisma.deliveryConstraint.findFirst({
      where: {
        serviceType: input.serviceType,
        vehicleType: VehicleType.BIKE,
        enabled: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!constraint) {
      throw new BadRequestException(
        `No active delivery constraint for ${input.serviceType}`,
      );
    }

    const maxDistanceKm = Number(constraint.maxDistanceKm);
    if (distanceKm > maxDistanceKm) {
      throw new BadRequestException({
        success: false,
        code: 'OVER_MAX_DISTANCE',
        error: 'OVER_MAX_DISTANCE',
        message: `Delivery distance ${distanceKm}km exceeds max ${maxDistanceKm}km`,
        distanceKm,
        maxDistanceKm,
        suggestParcel:
          constraint.overflowServiceType === LogisticsServiceType.PARCEL ||
          constraint.overflowServiceType ===
            LogisticsServiceType.EXPRESS_PARCEL,
        overflowServiceType: constraint.overflowServiceType,
      });
    }

    if (
      input.serviceType === LogisticsServiceType.GAS_DELIVERY &&
      !input.cylinderTypeId
    ) {
      throw new BadRequestException(
        'cylinderTypeId is required for gas delivery quotes',
      );
    }

    const rules = await this.prisma.deliveryPricingRule.findMany({
      where: {
        serviceType: input.serviceType,
        vehicleType: VehicleType.BIKE,
        enabled: true,
      },
    });

    const selected = selectDeliveryPricingRule(
      rules.map(toPricingRuleCandidate),
      {
        distanceKm,
        serviceType: input.serviceType,
        cylinderTypeId: input.cylinderTypeId,
        at: now,
      },
    );
    if (!selected) {
      throw new BadRequestException({
        success: false,
        code: 'NO_PRICING_RULE',
        error: 'NO_PRICING_RULE',
        message: `No delivery pricing rule for ${distanceKm}km`,
        distanceKm,
      });
    }

    return {
      customerCharge: selected.customerCharge,
      riderPay: selected.riderPay,
      platformCommission: selected.platformCommission,
      ruleId: selected.ruleId,
      constraintId: constraint.id,
      distanceKm,
      serviceType: input.serviceType,
      maxDistanceKm,
      suggestParcel: false,
    };
  }

  /**
   * Point-to-point fare for Transport (Phase 7): rides, parcel/courier/merchant
   * deliveries, and inter-county trips. Unlike `quoteForStore`, there is no
   * store or delivery-constraint radius check here — Ride creation itself
   * validates coordinates.
   *
   * RIDE and PARCEL/COURIER/MERCHANT fall back to `NORMAL_DELIVERY` bands
   * when no dedicated pricing rule exists yet, so quotes keep working before
   * a RIDE-specific seed is loaded.
   */
  public async quotePointToPoint(input: {
    readonly serviceType: RideServiceType;
    readonly pickupLat: number;
    readonly pickupLng: number;
    readonly dropoffLat: number;
    readonly dropoffLng: number;
    readonly vehicleType?: VehicleType;
    readonly routeId?: string;
    readonly weightCategory?: string;
  }): Promise<PointToPointQuoteResult> {
    const distanceKm =
      Math.round(
        haversineKm(
          input.pickupLat,
          input.pickupLng,
          input.dropoffLat,
          input.dropoffLng,
        ) * 1000,
      ) / 1000;

    if (input.serviceType === RideServiceType.INTER_COUNTY) {
      return this.quoteInterCountyRoute(input.routeId, distanceKm);
    }

    const vehicleType = input.vehicleType ?? VehicleType.BIKE;
    const primary = this.mapRideServiceTypeToLogistics(input.serviceType);

    let selected = await this.selectPointToPointRule(
      primary,
      vehicleType,
      distanceKm,
    );
    if (!selected) {
      selected = await this.selectPointToPointRule(
        LogisticsServiceType.NORMAL_DELIVERY,
        vehicleType,
        distanceKm,
      );
    }
    if (!selected) {
      throw new BadRequestException({
        success: false,
        code: 'NO_PRICING_RULE',
        error: 'NO_PRICING_RULE',
        message: `No delivery pricing rule for ${distanceKm}km`,
        distanceKm,
      });
    }

    const weightSurcharge = await this.resolveWeightSurcharge(
      input.weightCategory,
    );

    return {
      customerCharge: selected.customerCharge.add(weightSurcharge),
      riderPay: selected.riderPay.add(weightSurcharge),
      platformCommission: selected.platformCommission,
      ruleId: selected.ruleId,
      distanceKm,
      logisticsServiceType: primary,
      interCountyRouteId: null,
      weightSurcharge,
    };
  }

  private async quoteInterCountyRoute(
    routeId: string | undefined,
    distanceKm: number,
  ): Promise<PointToPointQuoteResult> {
    if (!routeId || !UUID_PATTERN.test(routeId)) {
      throw new NotFoundException('Inter-county route not found');
    }
    const route = await this.prisma.interCountyRoute.findFirst({
      where: { id: routeId, isActive: true, deletedAt: null },
    });
    if (!route) throw new NotFoundException('Inter-county route not found');

    const fare = kesFromBigInt(route.quotedFareAmount);
    return {
      customerCharge: fare,
      riderPay: fare,
      platformCommission: kesZero(),
      ruleId: null,
      distanceKm,
      logisticsServiceType: null,
      interCountyRouteId: route.id,
      weightSurcharge: kesZero(),
    };
  }

  /**
   * Weight surcharge for parcel-like point-to-point rides (Phase 14). Reads
   * `ParcelPricingProfile.weightRule` (e.g. `{"small":0,"medium":50,"large":100}`)
   * for the active `PARCEL` profile and falls back to zero when there's no
   * weight category, no active profile, or the key is missing/non-numeric.
   */
  private async resolveWeightSurcharge(weightCategory?: string): Promise<Money> {
    if (!weightCategory) return kesZero();
    const key = weightCategory.trim().toLowerCase();
    if (!['small', 'medium', 'large'].includes(key)) return kesZero();

    const now = new Date();
    const profile = await this.prisma.parcelPricingProfile.findFirst({
      where: {
        serviceType: LogisticsServiceType.PARCEL,
        enabled: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!profile || typeof profile.weightRule !== 'object' || profile.weightRule === null) {
      return kesZero();
    }

    const rule = profile.weightRule as Record<string, unknown>;
    const raw = rule[key] ?? rule[key.toUpperCase()] ?? rule[weightCategory.trim()];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return kesZero();
    }
    return kes(Math.trunc(raw));
  }

  private async selectPointToPointRule(
    serviceType: LogisticsServiceType,
    vehicleType: VehicleType,
    distanceKm: number,
  ) {
    const rules = await this.prisma.deliveryPricingRule.findMany({
      where: { serviceType, vehicleType, enabled: true },
    });
    return selectDeliveryPricingRule(rules.map(toPricingRuleCandidate), {
      distanceKm,
      serviceType,
    });
  }

  private mapRideServiceTypeToLogistics(
    serviceType: RideServiceType,
  ): LogisticsServiceType {
    if (serviceType === RideServiceType.RIDE) return LogisticsServiceType.RIDE;
    return LogisticsServiceType.PARCEL;
  }

  public mapVendorType(vendorType: string): StoreType {
    const key = vendorType.trim().toUpperCase();
    switch (key) {
      case 'FOOD':
      case 'RESTAURANT':
        return StoreType.RESTAURANT;
      case 'MARKET':
      case 'MARKETS':
        return StoreType.MARKET;
      case 'LIQUOR':
        return StoreType.LIQUOR;
      case 'GAS':
        return StoreType.GAS;
      default:
        throw new BadRequestException(`Unsupported vendorType: ${vendorType}`);
    }
  }

  /** Persist boundary helper used by callers writing Order rows. */
  public feesToBigInt(quote: DeliveryQuoteResult): {
    deliveryFeeAmount: bigint;
    riderPayAmount: bigint;
    platformCommissionAmount: bigint;
  } {
    return {
      deliveryFeeAmount: kesToBigInt(quote.customerCharge),
      riderPayAmount: kesToBigInt(quote.riderPay),
      platformCommissionAmount: kesToBigInt(quote.platformCommission),
    };
  }
}
