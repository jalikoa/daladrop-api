import { LogisticsServiceType } from '@prisma/client';
import { kes } from '../../../shared/money';
import {
  selectDeliveryPricingRule,
  type PricingRuleCandidate,
} from '../domain/pricing-selection';

const EFFECTIVE = new Date('2026-06-01T00:00:00.000Z');

function band(
  id: string,
  min: number,
  max: number,
  charge: number,
  extras: Partial<PricingRuleCandidate> = {},
): PricingRuleCandidate {
  return {
    id,
    serviceType: LogisticsServiceType.NORMAL_DELIVERY,
    distanceMinKm: min,
    distanceMaxKm: max,
    cylinderTypeId: null,
    customerCharge: BigInt(charge),
    riderPay: BigInt(charge - 20),
    platformCommission: 20n,
    priority: 100,
    enabled: true,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    ...extras,
  };
}

const NORMAL_BANDS = [
  band('r1', 0, 3, 120),
  band('r2', 3, 6, 170),
  band('r3', 6, 9, 220),
];

const GAS_6KG = 'c0000000-0000-4000-8000-000000000006';

describe('selectDeliveryPricingRule', () => {
  it('selects 0-3km band at 1.5km', () => {
    const selected = selectDeliveryPricingRule(NORMAL_BANDS, {
      distanceKm: 1.5,
      serviceType: LogisticsServiceType.NORMAL_DELIVERY,
      at: EFFECTIVE,
    });
    expect(selected?.ruleId).toBe('r1');
    expect(selected?.customerCharge.equals(kes(120))).toBe(true);
  });

  it('selects 3-6km band at 4.2km', () => {
    const selected = selectDeliveryPricingRule(NORMAL_BANDS, {
      distanceKm: 4.2,
      serviceType: LogisticsServiceType.NORMAL_DELIVERY,
      at: EFFECTIVE,
    });
    expect(selected?.ruleId).toBe('r2');
    expect(selected?.customerCharge.equals(kes(170))).toBe(true);
  });

  it('selects 6-9km band at 8.9km', () => {
    const selected = selectDeliveryPricingRule(NORMAL_BANDS, {
      distanceKm: 8.9,
      serviceType: LogisticsServiceType.NORMAL_DELIVERY,
      at: EFFECTIVE,
    });
    expect(selected?.ruleId).toBe('r3');
    expect(selected?.customerCharge.equals(kes(220))).toBe(true);
  });

  it('prefers lower priority then tighter band at overlapping boundary', () => {
    const rules = [
      band('wide', 0, 9, 999, { priority: 100 }),
      band('tight', 0, 3, 120, { priority: 50 }),
    ];
    const selected = selectDeliveryPricingRule(rules, {
      distanceKm: 2,
      serviceType: LogisticsServiceType.NORMAL_DELIVERY,
      at: EFFECTIVE,
    });
    expect(selected?.ruleId).toBe('tight');
  });

  it('matches gas cylinder type bands', () => {
    const rules: PricingRuleCandidate[] = [
      band('g6', 0, 3, 150, {
        serviceType: LogisticsServiceType.GAS_DELIVERY,
        cylinderTypeId: GAS_6KG,
      }),
      band('g13', 0, 3, 200, {
        serviceType: LogisticsServiceType.GAS_DELIVERY,
        cylinderTypeId: 'c0000000-0000-4000-8000-000000000013',
      }),
    ];
    const selected = selectDeliveryPricingRule(rules, {
      distanceKm: 2,
      serviceType: LogisticsServiceType.GAS_DELIVERY,
      cylinderTypeId: GAS_6KG,
      at: EFFECTIVE,
    });
    expect(selected?.ruleId).toBe('g6');
    expect(selected?.customerCharge.equals(kes(150))).toBe(true);
  });

  it('returns null when distance exceeds all bands', () => {
    const selected = selectDeliveryPricingRule(NORMAL_BANDS, {
      distanceKm: 9.5,
      serviceType: LogisticsServiceType.NORMAL_DELIVERY,
      at: EFFECTIVE,
    });
    expect(selected).toBeNull();
  });

  it('ignores disabled / not-yet-effective rules', () => {
    const rules = [
      band('future', 0, 3, 120, {
        effectiveFrom: new Date('2099-01-01T00:00:00.000Z'),
      }),
      band('off', 0, 3, 120, { enabled: false }),
    ];
    expect(
      selectDeliveryPricingRule(rules, {
        distanceKm: 1,
        serviceType: LogisticsServiceType.NORMAL_DELIVERY,
        at: EFFECTIVE,
      }),
    ).toBeNull();
  });
});
