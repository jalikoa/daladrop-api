import { kes, kesFromBigInt, type Money } from '../../../shared/money';

export interface PricingRuleCandidate {
  readonly id: string;
  readonly serviceType: string;
  readonly distanceMinKm: number;
  readonly distanceMaxKm: number;
  readonly cylinderTypeId: string | null;
  readonly customerCharge: bigint;
  readonly riderPay: bigint;
  readonly platformCommission: bigint;
  readonly priority: number;
  readonly enabled: boolean;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
}

export interface SelectedPricingRule {
  readonly ruleId: string;
  readonly customerCharge: Money;
  readonly riderPay: Money;
  readonly platformCommission: Money;
  readonly distanceMinKm: number;
  readonly distanceMaxKm: number;
  readonly priority: number;
}

function isEffective(rule: PricingRuleCandidate, at: Date): boolean {
  if (!rule.enabled) return false;
  if (rule.effectiveFrom.getTime() > at.getTime()) return false;
  if (rule.effectiveTo && rule.effectiveTo.getTime() <= at.getTime()) {
    return false;
  }
  return true;
}

function matchesDistance(
  rule: PricingRuleCandidate,
  distanceKm: number,
): boolean {
  return (
    distanceKm >= rule.distanceMinKm && distanceKm <= rule.distanceMaxKm
  );
}

function bandWidthKm(rule: PricingRuleCandidate): number {
  return rule.distanceMaxKm - rule.distanceMinKm;
}

/**
 * Picks the best DeliveryPricingRule for a distance / service / optional cylinder.
 * Ranking: priority ASC, then tightest distance band (smallest width).
 */
export function selectDeliveryPricingRule(
  rules: readonly PricingRuleCandidate[],
  input: {
    readonly distanceKm: number;
    readonly serviceType: string;
    readonly cylinderTypeId?: string | null;
    readonly at?: Date;
  },
): SelectedPricingRule | null {
  const at = input.at ?? new Date();
  const cylinder = input.cylinderTypeId ?? null;

  const eligible = rules.filter((rule) => {
    if (rule.serviceType !== input.serviceType) return false;
    if (!isEffective(rule, at)) return false;
    if (!matchesDistance(rule, input.distanceKm)) return false;
    if (cylinder) {
      return rule.cylinderTypeId === cylinder;
    }
    return rule.cylinderTypeId == null;
  });

  if (eligible.length === 0) return null;

  const sorted = [...eligible].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return bandWidthKm(a) - bandWidthKm(b);
  });

  const best = sorted[0]!;
  return {
    ruleId: best.id,
    customerCharge: kesFromBigInt(best.customerCharge),
    riderPay: kesFromBigInt(best.riderPay),
    platformCommission: kesFromBigInt(best.platformCommission),
    distanceMinKm: best.distanceMinKm,
    distanceMaxKm: best.distanceMaxKm,
    priority: best.priority,
  };
}

/** Builds a candidate from Prisma Decimal/BigInt row fields. */
export function toPricingRuleCandidate(row: {
  id: string;
  serviceType: string;
  distanceMinKm: { toString(): string } | number;
  distanceMaxKm: { toString(): string } | number;
  cylinderTypeId: string | null;
  customerCharge: bigint;
  riderPay: bigint;
  platformCommission: bigint;
  priority: number;
  enabled: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}): PricingRuleCandidate {
  return {
    id: row.id,
    serviceType: row.serviceType,
    distanceMinKm: Number(row.distanceMinKm),
    distanceMaxKm: Number(row.distanceMaxKm),
    cylinderTypeId: row.cylinderTypeId,
    customerCharge: row.customerCharge,
    riderPay: row.riderPay,
    platformCommission: row.platformCommission,
    priority: row.priority,
    enabled: row.enabled,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
  };
}

export function emptyKesFees(): {
  customerCharge: Money;
  riderPay: Money;
  platformCommission: Money;
} {
  return {
    customerCharge: kes(0),
    riderPay: kes(0),
    platformCommission: kes(0),
  };
}
