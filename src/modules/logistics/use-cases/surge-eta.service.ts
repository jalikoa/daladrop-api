import { Injectable } from '@nestjs/common';
import { kes, type Money } from '../../../shared/money';

/**
 * Surge pricing hook: configurable via env, with a simple peak-hour default.
 * Modules consume this rather than embedding surge math in quote services.
 */
@Injectable()
export class SurgePricingService {
  public resolveMultiplier(now = new Date()): number {
    const envRaw = process.env.TRANSPORT_SURGE_MULTIPLIER;
    if (envRaw) {
      const parsed = Number(envRaw);
      if (Number.isFinite(parsed) && parsed >= 1) {
        return Math.min(parsed, 5);
      }
    }
    const hour = now.getHours();
    // Peak: morning commute 7–9, evening 17–20 (East Africa local clock of host).
    if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 20)) {
      return 1.25;
    }
    return 1;
  }

  public apply(amount: Money, multiplier: number): Money {
    if (multiplier <= 1) return amount;
    const surged = Math.round(amount.amount * multiplier);
    return kes(surged);
  }
}

/** ETA estimate from distance using a configurable average speed. */
@Injectable()
export class RideEtaService {
  public estimateMinutes(distanceKm: number): number {
    const speedKmh = Number(process.env.TRANSPORT_AVG_SPEED_KMH ?? 22);
    const safeSpeed = Number.isFinite(speedKmh) && speedKmh > 0 ? speedKmh : 22;
    const minutes = Math.ceil((distanceKm / safeSpeed) * 60) + 3; // + boarding buffer
    return Math.max(3, Math.min(minutes, 180));
  }
}
