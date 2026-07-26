import { Injectable } from '@nestjs/common';
import {
  LogisticsServiceType,
  VehicleType,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DeliveryQuoteService } from '../../logistics/use-cases/delivery-quote.service';

export interface CustomerPricingPayload {
  readonly currency: 'KES';
  readonly serviceFee: number;
  readonly ordinaryDelivery: {
    readonly bands: readonly {
      readonly maxKm: number;
      readonly fee: number;
      /** Legacy alias keys expected by some clients (api-contracts). */
      readonly fromKm: number;
      readonly toKm: number;
      readonly customerFee: number;
    }[];
  };
  readonly gasDelivery: {
    readonly cylinders: Record<
      string,
      readonly {
        readonly maxKm: number;
        readonly fee: number;
        readonly fromKm: number;
        readonly toKm: number;
        readonly customerFee: number;
      }[]
    >;
    /** Gas orders must be paid before dispatch — no cash/pay-on-delivery. */
    readonly prepayRequired: boolean;
    /** Customer must hand back an empty cylinder on delivery (refill model). */
    readonly emptyCylinderExchangeRequired: boolean;
  };
  readonly maxRadiusKm: number;
  /** Profile/support contacts (Uidocs 18). Env or AppPricingConfig.payload.support. */
  readonly support: {
    readonly phone: string | null;
    readonly phoneDisplay: string | null;
    readonly email: string | null;
    readonly whatsapp: string | null;
  };
}

interface GasPolicyOverrides {
  readonly prepayRequired?: boolean;
  readonly emptyCylinderExchangeRequired?: boolean;
}

const CUSTOMER_PRICING_VERSION = 'customer-v1';

@Injectable()
export class ConfigPricingService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: DeliveryQuoteService,
  ) {}

  public async getCustomerPricing(): Promise<{
    readonly success: true;
    readonly pricing: CustomerPricingPayload;
  }> {
    const existing = await this.prisma.appPricingConfig.findUnique({
      where: { version: CUSTOMER_PRICING_VERSION },
    });
    const overrides = this.extractGasPolicyOverrides(existing?.payload);
    const built = await this.buildFromLogisticsTables(overrides);
    await this.upsertActiveCache(built, existing);
    return { success: true as const, pricing: built };
  }

  /**
   * Documented defaults are `prepayRequired: true` and
   * `emptyCylinderExchangeRequired: true`; an admin can persist different
   * values in the active AppPricingConfig payload and they will be kept on
   * subsequent rebuilds instead of being reset to the default.
   */
  private extractGasPolicyOverrides(payload: unknown): GasPolicyOverrides {
    if (!payload || typeof payload !== 'object') return {};
    const gasDelivery = (payload as { gasDelivery?: unknown }).gasDelivery;
    if (!gasDelivery || typeof gasDelivery !== 'object') return {};
    const candidate = gasDelivery as Record<string, unknown>;
    const overrides: GasPolicyOverrides = {};
    if (typeof candidate.prepayRequired === 'boolean') {
      Object.assign(overrides, { prepayRequired: candidate.prepayRequired });
    }
    if (typeof candidate.emptyCylinderExchangeRequired === 'boolean') {
      Object.assign(overrides, {
        emptyCylinderExchangeRequired: candidate.emptyCylinderExchangeRequired,
      });
    }
    return overrides;
  }

  private async buildFromLogisticsTables(
    overrides: GasPolicyOverrides = {},
  ): Promise<CustomerPricingPayload> {
    const now = new Date();
    const serviceFee = await this.quotes.resolveServiceFee();

    const constraint = await this.prisma.deliveryConstraint.findFirst({
      where: {
        serviceType: LogisticsServiceType.NORMAL_DELIVERY,
        vehicleType: VehicleType.BIKE,
        enabled: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    const rules = await this.prisma.deliveryPricingRule.findMany({
      where: {
        enabled: true,
        vehicleType: VehicleType.BIKE,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        serviceType: {
          in: [
            LogisticsServiceType.NORMAL_DELIVERY,
            LogisticsServiceType.GAS_DELIVERY,
          ],
        },
      },
      include: {
        cylinderType: { select: { code: true, name: true, weightKg: true } },
      },
      orderBy: [{ distanceMaxKm: 'asc' }, { priority: 'asc' }],
    });

    const ordinaryBands = rules
      .filter((r) => r.serviceType === LogisticsServiceType.NORMAL_DELIVERY)
      .filter((r) => r.cylinderTypeId == null)
      .map((r) =>
        this.toBand(r.distanceMinKm, r.distanceMaxKm, r.customerCharge),
      );

    const cylinders: Record<
      string,
      {
        maxKm: number;
        fee: number;
        fromKm: number;
        toKm: number;
        customerFee: number;
      }[]
    > = {};
    for (const rule of rules) {
      if (rule.serviceType !== LogisticsServiceType.GAS_DELIVERY) continue;
      const key = this.cylinderKey(rule.cylinderType);
      if (!cylinders[key]) cylinders[key] = [];
      cylinders[key].push(
        this.toBand(
          rule.distanceMinKm,
          rule.distanceMaxKm,
          rule.customerCharge,
        ),
      );
    }

    return {
      currency: 'KES',
      serviceFee: serviceFee.amount,
      ordinaryDelivery: { bands: ordinaryBands },
      gasDelivery: {
        cylinders,
        prepayRequired: overrides.prepayRequired ?? true,
        emptyCylinderExchangeRequired:
          overrides.emptyCylinderExchangeRequired ?? true,
      },
      maxRadiusKm: constraint ? Number(constraint.maxDistanceKm) : 0,
      support: this.resolveSupportContacts(),
    };
  }

  private resolveSupportContacts(): CustomerPricingPayload['support'] {
    const phone = process.env.SUPPORT_PHONE?.trim() || null;
    const email = process.env.SUPPORT_EMAIL?.trim() || null;
    const whatsapp = process.env.SUPPORT_WHATSAPP?.trim() || null;
    return { phone, phoneDisplay: phone, email, whatsapp };
  }

  private toBand(
    distanceMinKm: unknown,
    distanceMaxKm: unknown,
    customerCharge: unknown,
  ): {
    maxKm: number;
    fee: number;
    fromKm: number;
    toKm: number;
    customerFee: number;
  } {
    const fromKm = Number(distanceMinKm ?? 0);
    const toKm = Number(distanceMaxKm);
    const fee = Number(customerCharge);
    return { maxKm: toKm, fee, fromKm, toKm, customerFee: fee };
  }

  private cylinderKey(
    cylinderType: { code: string; name: string; weightKg: unknown } | null,
  ): string {
    if (!cylinderType) return 'unknown';
    const weight = Number(cylinderType.weightKg);
    if (Number.isFinite(weight) && weight > 0) {
      return `${Math.trunc(weight)}kg`;
    }
    const fromCode = cylinderType.code.match(/(\d+)\s*kg/i);
    if (fromCode) return `${fromCode[1]}kg`;
    return cylinderType.code.toLowerCase();
  }

  private async upsertActiveCache(
    payload: CustomerPricingPayload,
    existing: { id: string } | null | undefined,
  ): Promise<void> {
    if (existing) {
      await this.prisma.appPricingConfig.update({
        where: { id: existing.id },
        data: {
          payload: payload as object,
          isActive: true,
          currency: 'KES',
        },
      });
      await this.prisma.appPricingConfig.updateMany({
        where: { id: { not: existing.id }, isActive: true },
        data: { isActive: false },
      });
      return;
    }
    await this.prisma.appPricingConfig.create({
      data: {
        version: CUSTOMER_PRICING_VERSION,
        currency: 'KES',
        payload: payload as object,
        isActive: true,
      },
    });
  }
}
