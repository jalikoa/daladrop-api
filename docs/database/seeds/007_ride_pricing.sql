-- ===========================================================================
-- Seed: RIDE (boda) point-to-point pricing bands — Phase 7 Transport.
-- Mirrors the NORMAL_DELIVERY bands from 002_daladrop_pricing_and_policies.sql
-- so `/v1/ride/quote` and ride creation resolve a RIDE-specific rule instead
-- of always falling back to NORMAL_DELIVERY.
-- Idempotent by id. Also applied via
-- prisma/migrations/20260726180000_transport_rides_permissions/migration.sql
-- for deploy — this file exists for manual/local seeding parity.
-- ===========================================================================

INSERT INTO delivery_pricing_rules (
  id, name, service_type, vehicle_type,
  distance_min_km, distance_max_km,
  customer_charge, rider_pay, platform_commission,
  currency, base_currency, exchange_rate,
  effective_from, priority, enabled, version, created_at, updated_at
) VALUES
  ('b0000000-0000-4000-8000-000000000401', 'Ride 0-3km', 'RIDE', 'BIKE', 0, 3,
    120, 100, 20, 'KES', 'KES', 1, TIMESTAMPTZ '2026-01-01 00:00:00+03', 100, TRUE, 0, NOW(), NOW()),
  ('b0000000-0000-4000-8000-000000000402', 'Ride >3-6km', 'RIDE', 'BIKE', 3, 6,
    170, 140, 30, 'KES', 'KES', 1, TIMESTAMPTZ '2026-01-01 00:00:00+03', 100, TRUE, 0, NOW(), NOW()),
  ('b0000000-0000-4000-8000-000000000403', 'Ride >6-9km', 'RIDE', 'BIKE', 6, 9,
    220, 180, 40, 'KES', 'KES', 1, TIMESTAMPTZ '2026-01-01 00:00:00+03', 100, TRUE, 0, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
