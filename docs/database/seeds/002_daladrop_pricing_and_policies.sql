-- ===========================================================================
-- Seed: Daladrop pricing, constraints, settlement policy, CoA
-- Run AFTER migrations. Idempotent where unique keys exist.
-- Amounts are minor units with scale 0 for KES whole shillings (KES 120 => 120).
-- Adjust Money VO mapping in app if using cents instead.
-- DO NOT run from automated agents against live DBs without review.
-- ===========================================================================

-- Chart of accounts
INSERT INTO charts_of_accounts (id, code, name, description, currency, is_default, created_at, updated_at)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'DALADROP_KES',
  'Daladrop Primary KES',
  'Default chart for Kenyan operations',
  'KES',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO accounts (id, chart_of_accounts_id, code, name, account_type, normal_balance, currency, is_system, is_active, created_at, updated_at)
SELECT gen_random_uuid(), c.id, v.code, v.name, v.account_type::"AccountType", v.normal_balance::"NormalBalance", 'KES', TRUE, TRUE, NOW(), NOW()
FROM charts_of_accounts c
CROSS JOIN (VALUES
  ('1000', 'Platform Cash (M-Pesa Clearing)', 'ASSET', 'DEBIT'),
  ('1100', 'Customer Wallets', 'LIABILITY', 'CREDIT'),
  ('1200', 'Escrow — Commerce', 'LIABILITY', 'CREDIT'),
  ('1300', 'Escrow — Rides', 'LIABILITY', 'CREDIT'),
  ('2000', 'Merchant Payables', 'LIABILITY', 'CREDIT'),
  ('2100', 'Rider Payables', 'LIABILITY', 'CREDIT'),
  ('2200', 'Organizer Payables', 'LIABILITY', 'CREDIT'),
  ('3000', 'Daladrop Revenue Holding', 'LIABILITY', 'CREDIT'),
  ('4000', 'Service Fee Revenue', 'REVENUE', 'CREDIT'),
  ('4100', 'Delivery Fee / Platform Margin', 'REVENUE', 'CREDIT'),
  ('4200', 'Ticket Platform Fee Revenue', 'REVENUE', 'CREDIT'),
  ('5000', 'Delivery Expense (Rider Cost)', 'EXPENSE', 'DEBIT'),
  ('5100', 'Refunds & Chargebacks', 'EXPENSE', 'DEBIT'),
  ('6000', 'Payout Clearing', 'ASSET', 'DEBIT')
) AS v(code, name, account_type, normal_balance)
WHERE c.code = 'DALADROP_KES'
ON CONFLICT (chart_of_accounts_id, code) DO NOTHING;

-- Roles
INSERT INTO roles (id, code, name, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'CUSTOMER'::"RoleCode", 'Customer', 'End customer', NOW(), NOW()),
  (gen_random_uuid(), 'RIDER'::"RoleCode", 'Rider', 'Delivery / ride partner', NOW(), NOW()),
  (gen_random_uuid(), 'MERCHANT_OWNER'::"RoleCode", 'Merchant Owner', 'Store owner', NOW(), NOW()),
  (gen_random_uuid(), 'MERCHANT_STAFF'::"RoleCode", 'Merchant Staff', 'Store staff', NOW(), NOW()),
  (gen_random_uuid(), 'ORGANIZER'::"RoleCode", 'Event Organizer', 'Events host', NOW(), NOW()),
  (gen_random_uuid(), 'ADMIN'::"RoleCode", 'Admin', 'Platform admin', NOW(), NOW()),
  (gen_random_uuid(), 'SUPPORT'::"RoleCode", 'Support', 'Customer support', NOW(), NOW()),
  (gen_random_uuid(), 'FINANCE'::"RoleCode", 'Finance', 'Finance operations', NOW(), NOW()),
  (gen_random_uuid(), 'SYSTEM'::"RoleCode", 'System', 'Service account', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Cylinder types (gas)
INSERT INTO cylinder_types (id, code, name, weight_kg, description, is_active, created_at, updated_at)
VALUES
  ('c0000000-0000-4000-8000-000000000006', 'CYL_6KG', '6 kg cylinder', 6.000, 'Standard household 6kg LPG', TRUE, NOW(), NOW()),
  ('c0000000-0000-4000-8000-000000000013', 'CYL_13KG', '13 kg cylinder', 13.000, 'Standard household 13kg LPG', TRUE, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Normal delivery constraint (restaurants, liquor, markets, gas product path uses same radius)
INSERT INTO delivery_constraints (
  id, name, service_type, vehicle_type,
  max_distance_km, max_weight_kg, max_length_cm, max_width_cm, max_height_cm,
  overflow_service_type, effective_from, effective_to, enabled, version, created_at, updated_at
) VALUES (
  'd0000000-0000-4000-8000-000000000001',
  'Normal bike delivery',
  'NORMAL_DELIVERY'::"LogisticsServiceType",
  'BIKE'::"VehicleType",
  9.000, 9.000, 40.00, 40.00, 30.00,
  'PARCEL'::"LogisticsServiceType",
  TIMESTAMPTZ '2026-01-01 00:00:00+03',
  NULL,
  TRUE,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO delivery_constraints (
  id, name, service_type, vehicle_type,
  max_distance_km, max_weight_kg, max_length_cm, max_width_cm, max_height_cm,
  overflow_service_type, effective_from, enabled, version, created_at, updated_at
) VALUES (
  'd0000000-0000-4000-8000-000000000002',
  'Gas bike delivery',
  'GAS_DELIVERY'::"LogisticsServiceType",
  'BIKE'::"VehicleType",
  9.000, 15.000, 40.00, 40.00, 80.00,
  'PARCEL'::"LogisticsServiceType",
  TIMESTAMPTZ '2026-01-01 00:00:00+03',
  TRUE,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Normal delivery pricing bands (customer / rider / platform)
INSERT INTO delivery_pricing_rules (
  id, name, service_type, vehicle_type,
  distance_min_km, distance_max_km,
  customer_charge, rider_pay, platform_commission,
  currency, base_currency, exchange_rate,
  effective_from, priority, enabled, version, created_at, updated_at
) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'Normal 0-3km', 'NORMAL_DELIVERY', 'BIKE', 0, 3,
    120, 100, 20, 'KES', 'KES', 1, TIMESTAMPTZ '2026-01-01 00:00:00+03', 100, TRUE, 0, NOW(), NOW()),
  ('b0000000-0000-4000-8000-000000000002', 'Normal >3-6km', 'NORMAL_DELIVERY', 'BIKE', 3, 6,
    170, 140, 30, 'KES', 'KES', 1, TIMESTAMPTZ '2026-01-01 00:00:00+03', 100, TRUE, 0, NOW(), NOW()),
  ('b0000000-0000-4000-8000-000000000003', 'Normal >6-9km', 'NORMAL_DELIVERY', 'BIKE', 6, 9,
    220, 180, 40, 'KES', 'KES', 1, TIMESTAMPTZ '2026-01-01 00:00:00+03', 100, TRUE, 0, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Gas 6kg bands
INSERT INTO delivery_pricing_rules (
  id, name, service_type, vehicle_type, cylinder_type_id,
  distance_min_km, distance_max_km,
  customer_charge, rider_pay, platform_commission,
  currency, base_currency, exchange_rate,
  effective_from, priority, enabled, version, created_at, updated_at
) VALUES
  ('b0000000-0000-4000-8000-000000000106', 'Gas 6kg 0-3km', 'GAS_DELIVERY', 'BIKE',
    'c0000000-0000-4000-8000-000000000006', 0, 3,
    150, 120, 30, 'KES', 'KES', 1, TIMESTAMPTZ '2026-01-01 00:00:00+03', 100, TRUE, 0, NOW(), NOW()),
  ('b0000000-0000-4000-8000-000000000206', 'Gas 6kg >3-6km', 'GAS_DELIVERY', 'BIKE',
    'c0000000-0000-4000-8000-000000000006', 3, 6,
    200, 170, 30, 'KES', 'KES', 1, TIMESTAMPTZ '2026-01-01 00:00:00+03', 100, TRUE, 0, NOW(), NOW()),
  ('b0000000-0000-4000-8000-000000000306', 'Gas 6kg >6-9km', 'GAS_DELIVERY', 'BIKE',
    'c0000000-0000-4000-8000-000000000006', 6, 9,
    250, 220, 30, 'KES', 'KES', 1, TIMESTAMPTZ '2026-01-01 00:00:00+03', 100, TRUE, 0, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Gas 13kg bands
INSERT INTO delivery_pricing_rules (
  id, name, service_type, vehicle_type, cylinder_type_id,
  distance_min_km, distance_max_km,
  customer_charge, rider_pay, platform_commission,
  currency, base_currency, exchange_rate,
  effective_from, priority, enabled, version, created_at, updated_at
) VALUES
  ('b0000000-0000-4000-8000-000000000113', 'Gas 13kg 0-3km', 'GAS_DELIVERY', 'BIKE',
    'c0000000-0000-4000-8000-000000000013', 0, 3,
    200, 150, 50, 'KES', 'KES', 1, TIMESTAMPTZ '2026-01-01 00:00:00+03', 100, TRUE, 0, NOW(), NOW()),
  ('b0000000-0000-4000-8000-000000000213', 'Gas 13kg >3-6km', 'GAS_DELIVERY', 'BIKE',
    'c0000000-0000-4000-8000-000000000013', 3, 6,
    250, 200, 50, 'KES', 'KES', 1, TIMESTAMPTZ '2026-01-01 00:00:00+03', 100, TRUE, 0, NOW(), NOW()),
  ('b0000000-0000-4000-8000-000000000313', 'Gas 13kg >6-9km', 'GAS_DELIVERY', 'BIKE',
    'c0000000-0000-4000-8000-000000000013', 6, 9,
    300, 250, 50, 'KES', 'KES', 1, TIMESTAMPTZ '2026-01-01 00:00:00+03', 100, TRUE, 0, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Rider weekly settlement — Friday 16:30 Africa/Nairobi (not hardcoded in app)
INSERT INTO settlement_policies (
  id, name, beneficiary_type, frequency, cutoff_day, cutoff_time, timezone,
  minimum_amount, currency, requires_approval, auto_settlement, enabled, version, created_at, updated_at
) VALUES (
  'e0000000-0000-4000-8000-000000000001',
  'Rider weekly Friday payout',
  'RIDER'::"WalletOwnerType",
  'WEEKLY'::"SettlementFrequency",
  5,
  '16:30:00',
  'Africa/Nairobi',
  0,
  'KES',
  FALSE,
  TRUE,
  TRUE,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Parcel profile stub (rules in JSON — editable without schema change)
INSERT INTO parcel_pricing_profiles (
  id, name, service_type, distance_rule, weight_rule, volume_rule, insurance_rule,
  express_charge, fragile_surcharge, currency, base_currency, exchange_rate,
  effective_from, enabled, version, created_at, updated_at
) VALUES (
  'f0000000-0000-4000-8000-000000000001',
  'Standard parcel',
  'PARCEL'::"LogisticsServiceType",
  '{"base":150,"perKm":25}'::jsonb,
  '{"small":0,"medium":50,"large":100}'::jsonb,
  '{"perLitre":0}'::jsonb,
  '{"rateBps":100,"min":50}'::jsonb,
  100, 50, 'KES', 'KES', 1,
  TIMESTAMPTZ '2026-01-01 00:00:00+03', TRUE, 0, NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parcel_pricing_profiles (
  id, name, service_type, distance_rule, weight_rule, express_charge, fragile_surcharge,
  currency, base_currency, exchange_rate, effective_from, enabled, version, created_at, updated_at
) VALUES (
  'f0000000-0000-4000-8000-000000000002',
  'Intercounty',
  'INTER_COUNTY'::"LogisticsServiceType",
  '{"routeBased":true}'::jsonb,
  '{"included":true}'::jsonb,
  0, 0, 'KES', 'KES', 1,
  TIMESTAMPTZ '2026-01-01 00:00:00+03', TRUE, 0, NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;
