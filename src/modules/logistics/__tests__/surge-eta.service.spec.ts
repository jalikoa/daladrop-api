import { SurgePricingService, RideEtaService } from '../use-cases/surge-eta.service';
import { kes } from '../../../shared/money';

describe('SurgePricingService', () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env = { ...previous };
  });

  it('honours TRANSPORT_SURGE_MULTIPLIER env', () => {
    process.env.TRANSPORT_SURGE_MULTIPLIER = '1.5';
    const surge = new SurgePricingService();
    expect(surge.resolveMultiplier()).toBe(1.5);
    expect(surge.apply(kes(100), 1.5).amount).toBe(150);
  });

  it('caps multiplier at 5', () => {
    process.env.TRANSPORT_SURGE_MULTIPLIER = '99';
    expect(new SurgePricingService().resolveMultiplier()).toBe(5);
  });
});

describe('RideEtaService', () => {
  it('estimates minutes from distance', () => {
    process.env.TRANSPORT_AVG_SPEED_KMH = '30';
    const eta = new RideEtaService();
    // 15 km @ 30 km/h = 30 min + 3 buffer
    expect(eta.estimateMinutes(15)).toBe(33);
  });
});
