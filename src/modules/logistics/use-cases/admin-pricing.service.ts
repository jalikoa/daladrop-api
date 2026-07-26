import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VehicleType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { kes, kesToBigInt } from '../../../shared/money';
import type {
  CreateDeliveryConstraintDto,
  CreateDeliveryPricingRuleDto,
  UpdateDeliveryConstraintDto,
  UpdateDeliveryPricingRuleDto,
} from '../dto/logistics.dto';

@Injectable()
export class AdminPricingService {
  public constructor(private readonly prisma: PrismaService) {}

  public async listRules() {
    const rows = await this.prisma.deliveryPricingRule.findMany({
      orderBy: [
        { serviceType: 'asc' },
        { priority: 'asc' },
        { distanceMinKm: 'asc' },
      ],
      include: {
        cylinderType: { select: { id: true, code: true, name: true } },
      },
    });
    return { items: rows.map((row) => this.toRuleView(row)) };
  }

  public async createRule(input: CreateDeliveryPricingRuleDto) {
    const row = await this.prisma.deliveryPricingRule.create({
      data: {
        name: input.name ?? null,
        serviceType: input.serviceType,
        vehicleType: input.vehicleType ?? VehicleType.BIKE,
        distanceMinKm: input.distanceMinKm,
        distanceMaxKm: input.distanceMaxKm,
        cylinderTypeId: input.cylinderTypeId ?? null,
        customerCharge: kesToBigInt(kes(input.customerCharge)),
        riderPay: kesToBigInt(kes(input.riderPay)),
        platformCommission: kesToBigInt(kes(input.platformCommission)),
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        priority: input.priority ?? 100,
        enabled: input.enabled ?? true,
      },
      include: {
        cylinderType: { select: { id: true, code: true, name: true } },
      },
    });
    return this.toRuleView(row);
  }

  public async updateRule(id: string, input: UpdateDeliveryPricingRuleDto) {
    const existing = await this.prisma.deliveryPricingRule.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Pricing rule not found');

    const row = await this.prisma.deliveryPricingRule.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.distanceMinKm !== undefined
          ? { distanceMinKm: input.distanceMinKm }
          : {}),
        ...(input.distanceMaxKm !== undefined
          ? { distanceMaxKm: input.distanceMaxKm }
          : {}),
        ...(input.cylinderTypeId !== undefined
          ? input.cylinderTypeId
            ? { cylinderType: { connect: { id: input.cylinderTypeId } } }
            : { cylinderType: { disconnect: true } }
          : {}),
        ...(input.customerCharge !== undefined
          ? { customerCharge: kesToBigInt(kes(input.customerCharge)) }
          : {}),
        ...(input.riderPay !== undefined
          ? { riderPay: kesToBigInt(kes(input.riderPay)) }
          : {}),
        ...(input.platformCommission !== undefined
          ? {
              platformCommission: kesToBigInt(kes(input.platformCommission)),
            }
          : {}),
        ...(input.effectiveFrom !== undefined
          ? { effectiveFrom: new Date(input.effectiveFrom) }
          : {}),
        ...(input.effectiveTo !== undefined
          ? {
              effectiveTo: input.effectiveTo
                ? new Date(input.effectiveTo)
                : null,
            }
          : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        version: { increment: 1 },
      },
      include: {
        cylinderType: { select: { id: true, code: true, name: true } },
      },
    });
    return this.toRuleView(row);
  }

  public async listConstraints() {
    const rows = await this.prisma.deliveryConstraint.findMany({
      orderBy: [{ serviceType: 'asc' }, { effectiveFrom: 'desc' }],
    });
    return { items: rows.map((row) => this.toConstraintView(row)) };
  }

  public async createConstraint(input: CreateDeliveryConstraintDto) {
    const row = await this.prisma.deliveryConstraint.create({
      data: {
        name: input.name,
        serviceType: input.serviceType,
        vehicleType: input.vehicleType ?? VehicleType.BIKE,
        maxDistanceKm: input.maxDistanceKm,
        maxWeightKg: input.maxWeightKg,
        maxLengthCm: input.maxLengthCm,
        maxWidthCm: input.maxWidthCm,
        maxHeightCm: input.maxHeightCm,
        overflowServiceType: input.overflowServiceType ?? null,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        enabled: input.enabled ?? true,
      },
    });
    return this.toConstraintView(row);
  }

  public async updateConstraint(
    id: string,
    input: UpdateDeliveryConstraintDto,
  ) {
    const existing = await this.prisma.deliveryConstraint.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Delivery constraint not found');

    const row = await this.prisma.deliveryConstraint.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.maxDistanceKm !== undefined
          ? { maxDistanceKm: input.maxDistanceKm }
          : {}),
        ...(input.maxWeightKg !== undefined
          ? { maxWeightKg: input.maxWeightKg }
          : {}),
        ...(input.maxLengthCm !== undefined
          ? { maxLengthCm: input.maxLengthCm }
          : {}),
        ...(input.maxWidthCm !== undefined
          ? { maxWidthCm: input.maxWidthCm }
          : {}),
        ...(input.maxHeightCm !== undefined
          ? { maxHeightCm: input.maxHeightCm }
          : {}),
        ...(input.overflowServiceType !== undefined
          ? { overflowServiceType: input.overflowServiceType }
          : {}),
        ...(input.effectiveFrom !== undefined
          ? { effectiveFrom: new Date(input.effectiveFrom) }
          : {}),
        ...(input.effectiveTo !== undefined
          ? {
              effectiveTo: input.effectiveTo
                ? new Date(input.effectiveTo)
                : null,
            }
          : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        version: { increment: 1 },
      },
    });
    return this.toConstraintView(row);
  }

  private toRuleView(row: {
    id: string;
    name: string | null;
    serviceType: string;
    vehicleType: string;
    distanceMinKm: unknown;
    distanceMaxKm: unknown;
    cylinderTypeId: string | null;
    customerCharge: bigint;
    riderPay: bigint;
    platformCommission: bigint;
    currency: string;
    priority: number;
    enabled: boolean;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    cylinderType?: { id: string; code: string; name: string } | null;
  }) {
    return {
      id: row.id,
      name: row.name,
      serviceType: row.serviceType,
      vehicleType: row.vehicleType,
      distanceMinKm: Number(row.distanceMinKm),
      distanceMaxKm: Number(row.distanceMaxKm),
      cylinderTypeId: row.cylinderTypeId,
      cylinderType: row.cylinderType ?? null,
      customerCharge: Number(row.customerCharge),
      riderPay: Number(row.riderPay),
      platformCommission: Number(row.platformCommission),
      currency: row.currency,
      priority: row.priority,
      enabled: row.enabled,
      effectiveFrom: row.effectiveFrom.toISOString(),
      effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString() : null,
    };
  }

  private toConstraintView(row: {
    id: string;
    name: string;
    serviceType: string;
    vehicleType: string;
    maxDistanceKm: unknown;
    maxWeightKg: unknown;
    maxLengthCm: unknown;
    maxWidthCm: unknown;
    maxHeightCm: unknown;
    overflowServiceType: string | null;
    enabled: boolean;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  }) {
    return {
      id: row.id,
      name: row.name,
      serviceType: row.serviceType,
      vehicleType: row.vehicleType,
      maxDistanceKm: Number(row.maxDistanceKm),
      maxWeightKg: Number(row.maxWeightKg),
      maxLengthCm: Number(row.maxLengthCm),
      maxWidthCm: Number(row.maxWidthCm),
      maxHeightCm: Number(row.maxHeightCm),
      overflowServiceType: row.overflowServiceType,
      enabled: row.enabled,
      effectiveFrom: row.effectiveFrom.toISOString(),
      effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString() : null,
    };
  }
}
