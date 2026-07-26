-- Verticals sample data: MARKET / LIQUOR / GAS stores + products and a
-- PUBLISHED event with a ticket type.
-- Depends on demo user 11111111-1111-4111-8111-111111111111 (003_auth_test_user.sql).

-- ---------------------------------------------------------------------------
-- Organizer / verticals merchant (is_organizer = TRUE so it may host events)
-- ---------------------------------------------------------------------------
INSERT INTO merchants (
  id, owner_user_id, name, legal_name, status, tax_id, featured, is_organizer,
  version, created_at, updated_at
)
VALUES (
  '12121212-1212-4121-8121-121212121212'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  'Dala Verticals',
  'Dala Verticals Ltd',
  'ACTIVE'::"MerchantStatus",
  'P059876543Z',
  TRUE,
  TRUE,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status, is_organizer = TRUE, featured = TRUE, updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Module-level categories (store_id NULL) for MARKET / LIQUOR / GAS
-- ---------------------------------------------------------------------------
INSERT INTO categories (
  id, store_id, module_type, name, slug, icon_key, image_url, sort_order,
  is_active, created_at, updated_at
)
VALUES
  ('c3333333-3333-4333-8333-333333333333'::uuid, NULL, 'MARKET'::"ModuleType",
   'Groceries', 'groceries', 'basket-outline',
   'https://cdn.daladrop.test/cat-groceries.png', 1, TRUE, NOW(), NOW()),
  ('c4444444-4444-4444-8444-444444444444'::uuid, NULL, 'LIQUOR'::"ModuleType",
   'Spirits', 'spirits', 'wine-outline',
   'https://cdn.daladrop.test/cat-spirits.png', 1, TRUE, NOW(), NOW()),
  ('c5555555-5555-4555-8555-555555555555'::uuid, NULL, 'GAS'::"ModuleType",
   'Cooking Gas', 'cooking-gas', 'flame-outline',
   'https://cdn.daladrop.test/cat-gas.png', 1, TRUE, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Stores: MARKET, LIQUOR, GAS
-- ---------------------------------------------------------------------------
INSERT INTO stores (
  id, merchant_id, store_type, name, slug, description, city, address, phone,
  image_url, cover_image_url, latitude, longitude, delivery_fee_hint, currency,
  minimum_order_amount, delivery_time_min, delivery_time_max, rating_avg,
  review_count, is_open, is_active, age_restricted, tags, navigation_route,
  version, created_at, updated_at
)
VALUES
  ('20000000-0000-4000-8000-000000000001'::uuid,
   '12121212-1212-4121-8121-121212121212'::uuid, 'MARKET'::"StoreType",
   'Kisumu Fresh Market', 'kisumu-fresh-market',
   'Fresh produce and groceries', 'Kisumu', 'Kibuye Market', '0712000101',
   'https://cdn.daladrop.test/market-logo.png',
   'https://cdn.daladrop.test/market-cover.png',
   -0.1000000, 34.7500000, 120, 'KES', 200, 25, 45, 4.30, 88,
   TRUE, TRUE, FALSE, ARRAY['Groceries', 'Fresh'],
   '/market/20000000-0000-4000-8000-000000000001', 0, NOW(), NOW()),
  ('20000000-0000-4000-8000-000000000002'::uuid,
   '12121212-1212-4121-8121-121212121212'::uuid, 'LIQUOR'::"StoreType",
   'Lakeside Wines & Spirits', 'lakeside-wines-spirits',
   'Wines, spirits and beers', 'Kisumu', 'Oginga Odinga Street', '0712000102',
   'https://cdn.daladrop.test/liquor-logo.png',
   'https://cdn.daladrop.test/liquor-cover.png',
   -0.0920000, 34.7690000, 150, 'KES', 500, 30, 60, 4.60, 143,
   TRUE, TRUE, TRUE, ARRAY['Spirits', 'Wine'],
   '/liquor/20000000-0000-4000-8000-000000000002', 0, NOW(), NOW()),
  ('20000000-0000-4000-8000-000000000003'::uuid,
   '12121212-1212-4121-8121-121212121212'::uuid, 'GAS'::"StoreType",
   'QuickGas Kisumu', 'quickgas-kisumu',
   'LPG refills and new cylinders', 'Kisumu', 'Ring Road', '0712000103',
   'https://cdn.daladrop.test/gas-logo.png',
   'https://cdn.daladrop.test/gas-cover.png',
   -0.0950000, 34.7600000, 100, 'KES', 0, 20, 40, 4.70, 205,
   TRUE, TRUE, FALSE, ARRAY['Cooking Gas', 'Refill'],
   '/gas/20000000-0000-4000-8000-000000000003', 0, NOW(), NOW())
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, is_active = TRUE, is_open = TRUE, updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Products (one per store)
-- ---------------------------------------------------------------------------
-- Gas products carry cylinder_type_id (from 002_daladrop_pricing_and_policies.sql
-- cylinder_types seed) so MultiCheckoutService can resolve GAS_DELIVERY pricing
-- bands (see resolveGasCylinderTypeId in multi-checkout.service.ts).
INSERT INTO products (
  id, store_id, category_id, cylinder_type_id, name, description, brand,
  price_amount, currency, image_url, in_stock, is_active, age_restricted,
  tags, sort_order, version, created_at, updated_at
)
VALUES
  ('21000000-0000-4000-8000-000000000001'::uuid,
   '20000000-0000-4000-8000-000000000001'::uuid,
   'c3333333-3333-4333-8333-333333333333'::uuid,
   NULL,
   'Sukuma Wiki Bunch', 'Fresh collard greens', NULL, 30, 'KES',
   'https://cdn.daladrop.test/sukuma.png', TRUE, TRUE, FALSE,
   ARRAY['fresh', 'popular'], 1, 0, NOW(), NOW()),
  ('21000000-0000-4000-8000-000000000002'::uuid,
   '20000000-0000-4000-8000-000000000002'::uuid,
   'c4444444-4444-4444-8444-444444444444'::uuid,
   NULL,
   'Kenya Cane 750ml', 'Premium cane spirit', 'Kenya Cane', 1200, 'KES',
   'https://cdn.daladrop.test/kenya-cane.png', TRUE, TRUE, TRUE,
   ARRAY['spirits'], 1, 0, NOW(), NOW()),
  ('21000000-0000-4000-8000-000000000003'::uuid,
   '20000000-0000-4000-8000-000000000003'::uuid,
   'c5555555-5555-4555-8555-555555555555'::uuid,
   'c0000000-0000-4000-8000-000000000013', -- 13kg cylinder type
   'K-Gas 13kg Refill', 'LPG cylinder refill', 'K-Gas', 3200, 'KES',
   'https://cdn.daladrop.test/kgas-13kg.png', TRUE, TRUE, FALSE,
   ARRAY['refill'], 1, 0, NOW(), NOW()),
  ('21000000-0000-4000-8000-000000000004'::uuid,
   '20000000-0000-4000-8000-000000000003'::uuid,
   'c5555555-5555-4555-8555-555555555555'::uuid,
   'c0000000-0000-4000-8000-000000000006', -- 6kg cylinder type
   'K-Gas 6kg Refill', 'LPG cylinder refill', 'K-Gas', 1800, 'KES',
   'https://cdn.daladrop.test/kgas-6kg.png', TRUE, TRUE, FALSE,
   ARRAY['refill'], 2, 0, NOW(), NOW())
ON CONFLICT (id) DO UPDATE
SET price_amount = EXCLUDED.price_amount,
    cylinder_type_id = EXCLUDED.cylinder_type_id,
    is_active = TRUE,
    updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Event category
-- ---------------------------------------------------------------------------
INSERT INTO event_categories (
  id, name, slug, icon_key, image_url, sort_order, is_active, created_at, updated_at
)
VALUES (
  '31000000-0000-4000-8000-000000000001'::uuid,
  'Concerts', 'concerts', 'musical-notes-outline',
  'https://cdn.daladrop.test/cat-concerts.png', 1, TRUE, NOW(), NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PUBLISHED event + ticket type
-- ---------------------------------------------------------------------------
INSERT INTO events (
  id, merchant_id, organizer_id, category_id, name, description, venue, address,
  city, banner_url, cover_image_url, gallery, start_at, end_at, status,
  latitude, longitude, rating_avg, review_count, is_featured, navigation_route,
  version, created_at, updated_at
)
VALUES (
  '30000000-0000-4000-8000-000000000001'::uuid,
  '12121212-1212-4121-8121-121212121212'::uuid,
  NULL,
  '31000000-0000-4000-8000-000000000001'::uuid,
  'Lakeside Live Fest',
  'An evening of live music by the lake.',
  'Kisumu Sports Ground',
  'Kisumu Sports Ground, Kisumu',
  'Kisumu',
  'https://cdn.daladrop.test/event-banner.png',
  'https://cdn.daladrop.test/event-cover.png',
  ARRAY['https://cdn.daladrop.test/event-1.png'],
  NOW() + INTERVAL '30 days',
  NOW() + INTERVAL '30 days' + INTERVAL '6 hours',
  'PUBLISHED'::"EventStatus",
  -0.0917000, 34.7680000, 4.80, 64, TRUE,
  '/event/30000000-0000-4000-8000-000000000001',
  0, NOW(), NOW()
)
ON CONFLICT (id) DO UPDATE
SET status = 'PUBLISHED'::"EventStatus", is_featured = TRUE, updated_at = NOW();

INSERT INTO event_ticket_types (
  id, event_id, product_id, name, price_amount, currency, total_qty, sold_qty,
  is_active, version, created_at, updated_at
)
VALUES
  (
    '32000000-0000-4000-8000-000000000001'::uuid,
    '30000000-0000-4000-8000-000000000001'::uuid,
    NULL,
    'Regular', 1500, 'KES', 500, 0, TRUE, 0, NOW(), NOW()
  ),
  (
    '32000000-0000-4000-8000-000000000002'::uuid,
    '30000000-0000-4000-8000-000000000001'::uuid,
    NULL,
    'Complimentary', 0, 'KES', 100, 0, TRUE, 0, NOW(), NOW()
  )
ON CONFLICT (id) DO UPDATE
SET price_amount = EXCLUDED.price_amount,
    total_qty = EXCLUDED.total_qty,
    is_active = TRUE,
    updated_at = NOW();
