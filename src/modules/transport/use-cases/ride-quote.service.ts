import { BadRequestException, Injectable } from '@nestjs/common';
import { RideServiceType, VehicleType } from '@prisma/client';
import { type Money } from '../../../shared/money';
import { DeliveryQuoteService } from '../../logistics/use-cases/delivery-quote.service';
import { QuoteEngineService } from '../../logistics/use-cases/quote-engine.service';
import {
  RideEtaService,
  SurgePricingService,
} from '../../logistics/use-cases/surge-eta.service';
import type { RideQuoteDto } from '../dto/transport.dto';

export interface RideFareInput {
  readonly serviceType: RideServiceType;
  readonly pickupLat: number;
  readonly pickupLng: number;
  readonly dropoffLat: number;
  readonly dropoffLng: number;
  readonly vehicleType?: string;
  readonly routeId?: string;
  readonly weightCategory?: string;
}

export interface RideFareResult {
  readonly customerCharge: Money;
  readonly riderPay: Money;
  readonly platformCommission: Money;
  readonly distanceKm: number;
  readonly deliveryPricingRuleId: string | null;
  readonly interCountyRouteId: string | null;
  readonly currency: string;
  readonly surgeMultiplier: number;
  readonly etaMinutes: number;
}

/** Wraps `DeliveryQuoteService.quotePointToPoint` for Transport's coordinate + fare contract. */
@Injectable()
export class RideQuoteService {
  public constructor(
    private readonly deliveryQuote: DeliveryQuoteService,
    private readonly surge: SurgePricingService,
    private readonly eta: RideEtaService,
    private readonly quoteEngine: QuoteEngineService,
  ) {}

  public assertCoords(input: {
    readonly pickupLat: unknown;
    readonly pickupLng: unknown;
    readonly dropoffLat: unknown;
    readonly dropoffLng: unknown;
  }): void {
    const values = [
      input.pickupLat,
      input.pickupLng,
      input.dropoffLat,
      input.dropoffLng,
    ];
    if (values.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
      throw new BadRequestException(
        'Valid pickupLat/pickupLng/dropoffLat/dropoffLng coordinates are required',
      );
    }
    const pickupLat = input.pickupLat as number;
    const pickupLng = input.pickupLng as number;
    const dropoffLat = input.dropoffLat as number;
    const dropoffLng = input.dropoffLng as number;

    if (pickupLat === 0 && pickupLng === 0) {
      throw new BadRequestException(
        'Pickup coordinates (0,0) are not a valid location',
      );
    }
    if (dropoffLat === 0 && dropoffLng === 0) {
      throw new BadRequestException(
        'Dropoff coordinates (0,0) are not a valid location',
      );
    }
    if (
      Math.abs(pickupLat) > 90 ||
      Math.abs(dropoffLat) > 90 ||
      Math.abs(pickupLng) > 180 ||
      Math.abs(dropoffLng) > 180
    ) {
      throw new BadRequestException('Coordinates are out of range');
    }
  }

  public async computeFare(input: RideFareInput): Promise<RideFareResult> {
    this.assertCoords(input);
    const result = await this.deliveryQuote.quotePointToPoint({
      serviceType: input.serviceType,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      vehicleType: this.toVehicleType(input.vehicleType),
      routeId: input.routeId,
      weightCategory: input.weightCategory,
    });
    const surgeMultiplier = this.surge.resolveMultiplier();
    const customerCharge = this.surge.apply(
      result.customerCharge,
      surgeMultiplier,
    );
    return {
      customerCharge,
      riderPay: result.riderPay,
      platformCommission: result.platformCommission,
      distanceKm: result.distanceKm,
      deliveryPricingRuleId: result.ruleId,
      interCountyRouteId: result.interCountyRouteId,
      currency: 'KES',
      surgeMultiplier,
      etaMinutes: this.eta.estimateMinutes(result.distanceKm),
    };
  }

  /** Persists a server quote (single source of truth) and returns full breakdown. */
  public async quote(input: RideQuoteDto & { readonly customerId?: string }) {
    this.assertCoords(input);
    return this.quoteEngine.quoteTransport({
      customerId: input.customerId,
      serviceType: input.serviceType,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      vehicleType: input.vehicleType,
      routeId: input.routeId,
      weightCategory: input.weightCategory,
    });
  }

  private toVehicleType(value?: string): VehicleType | undefined {
    if (!value) return undefined;
    const key = value.trim().toUpperCase();
    return key in VehicleType ? (key as VehicleType) : undefined;
  }
}
