-- Seed: courier partners + inter-county routes for transport/parcel discovery.
-- Idempotent. Used by GET /v1/transport/courier-partners and inter-county/routes.

INSERT INTO courier_partners (id, name, brand_url, is_active, created_at, updated_at)
VALUES
  ('cp000000-0000-4000-8000-000000000001', 'Fargo Courier', NULL, TRUE, NOW(), NOW()),
  ('cp000000-0000-4000-8000-000000000002', 'G4S Parcel', NULL, TRUE, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO inter_county_routes (
  id, label, quoted_fare_amount, currency, default_pickup, default_dropoff,
  is_active, created_at, updated_at
)
VALUES
  (
    'ic000000-0000-4000-8000-000000000001',
    'Kisumu → Nairobi',
    2500,
    'KES',
    'Kisumu CBD',
    'Nairobi CBD',
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'ic000000-0000-4000-8000-000000000002',
    'Kisumu → Eldoret',
    1800,
    'KES',
    'Kisumu CBD',
    'Eldoret Town',
    TRUE,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;
