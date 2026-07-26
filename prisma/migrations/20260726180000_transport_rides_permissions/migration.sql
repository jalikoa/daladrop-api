-- Phase 7: Transport (rides). Admin permissions for ride oversight (no admin
-- controller ships yet — grants land ahead of it so RBAC doesn't need a
-- follow-up migration once one is built) + RIDE pricing bands mirroring the
-- existing NORMAL_DELIVERY bands so `/ride/quote` works without a separate
-- seed step in freshly-deployed environments.

INSERT INTO "permissions" ("id", "code", "resource", "action", "description", "created_at")
VALUES
  (gen_random_uuid(), 'rides.read', 'rides', 'read', 'View ride/transport orders and status history', NOW()),
  (gen_random_uuid(), 'rides.manage', 'rides', 'manage', 'Manage ride lifecycle, cancellations, and assignments', NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('ADMIN', 'SUPPORT')
  AND p.code IN ('rides.read', 'rides.manage')
ON CONFLICT DO NOTHING;

-- RIDE point-to-point pricing bands (boda). Mirrors NORMAL_DELIVERY 0-3/3-6/6-9km bands.
INSERT INTO delivery_pricing_rules (
  id, name, service_type, vehicle_type,
  distance_min_km, distance_max_km,
  customer_charge, rider_pay, platform_commission,
  currency, base_currency, exchange_rate,
  effective_from, priority, enabled, version, created_at, updated_at
) VALUES
  -- Stable deterministic UUIDs (hex-only; prefix letters must be a–f).
  ('b0000000-0000-4000-8000-000000000401', 'Ride 0-3km', 'RIDE', 'BIKE', 0, 3,
    120, 100, 20, 'KES', 'KES', 1, TIMESTAMPTZ '2026-01-01 00:00:00+03', 100, TRUE, 0, NOW(), NOW()),
  ('b0000000-0000-4000-8000-000000000402', 'Ride >3-6km', 'RIDE', 'BIKE', 3, 6,
    170, 140, 30, 'KES', 'KES', 1, TIMESTAMPTZ '2026-01-01 00:00:00+03', 100, TRUE, 0, NOW(), NOW()),
  ('b0000000-0000-4000-8000-000000000403', 'Ride >6-9km', 'RIDE', 'BIKE', 6, 9,
    220, 180, 40, 'KES', 'KES', 1, TIMESTAMPTZ '2026-01-01 00:00:00+03', 100, TRUE, 0, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
