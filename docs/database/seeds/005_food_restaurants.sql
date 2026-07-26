-- Food discovery sample data for restaurants / menu / categories.
-- Depends on demo user 11111111-1111-4111-8111-111111111111 (003_auth_test_user.sql).

INSERT INTO merchants (
  id, owner_user_id, name, legal_name, status, tax_id, featured, is_organizer,
  version, created_at, updated_at
)
VALUES (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  'Java Foods',
  'Java Foods Ltd',
  'ACTIVE'::"MerchantStatus",
  'P051234567A',
  TRUE,
  FALSE,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status, featured = TRUE, updated_at = NOW();

INSERT INTO merchant_kyc (
  id, merchant_id, status, business_registration_number, tax_pin,
  business_address, document_urls, submitted_at, reviewed_at, version,
  created_at, updated_at
)
VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
  'APPROVED'::"MerchantKycStatus",
  'BN-2024-001',
  'P051234567A',
  'Kisumu CBD',
  '[]'::jsonb,
  NOW(),
  NOW(),
  0,
  NOW(),
  NOW()
)
ON CONFLICT (merchant_id) DO UPDATE
SET status = 'APPROVED'::"MerchantKycStatus", updated_at = NOW();

INSERT INTO stores (
  id, merchant_id, store_type, name, slug, description, city, address, phone,
  image_url, cover_image_url, latitude, longitude, delivery_fee_hint, currency,
  minimum_order_amount, delivery_time_min, delivery_time_max, rating_avg,
  review_count, is_open, is_active, age_restricted, tags, navigation_route,
  version, created_at, updated_at
)
VALUES (
  'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
  'RESTAURANT'::"StoreType",
  'Java Weston',
  'java-weston',
  'Coffee and fast bites in Kisumu',
  'Kisumu',
  'Oginga Odinga Street',
  '0712000000',
  'https://cdn.daladrop.test/java-logo.png',
  'https://cdn.daladrop.test/java-cover.png',
  -0.0917000,
  34.7680000,
  150,
  'KES',
  300,
  20,
  40,
  4.50,
  512,
  TRUE,
  TRUE,
  FALSE,
  ARRAY['Fast Food', 'Coffee'],
  '/restaurant/ffffffff-ffff-4fff-8fff-ffffffffffff',
  0,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  tags = EXCLUDED.tags,
  is_active = TRUE,
  is_open = TRUE,
  rating_avg = EXCLUDED.rating_avg,
  updated_at = NOW();

INSERT INTO store_opening_hours (id, store_id, day, open_time, close_time, is_closed, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid, 'MON', '08:00', '22:00', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid, 'TUE', '08:00', '22:00', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid, 'WED', '08:00', '22:00', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid, 'THU', '08:00', '22:00', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid, 'FRI', '08:00', '23:00', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid, 'SAT', '09:00', '23:00', FALSE, NOW(), NOW()),
  (gen_random_uuid(), 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid, 'SUN', '09:00', '21:00', FALSE, NOW(), NOW())
ON CONFLICT (store_id, day) DO UPDATE
SET open_time = EXCLUDED.open_time, close_time = EXCLUDED.close_time, is_closed = FALSE;

INSERT INTO categories (
  id, store_id, module_type, name, slug, icon_key, image_url, sort_order,
  is_active, created_at, updated_at
)
VALUES
  (
    'c1111111-1111-4111-8111-111111111111'::uuid,
    NULL,
    'FOOD'::"ModuleType",
    'Fast Food',
    'fast-food',
    'fast-food-outline',
    'https://cdn.daladrop.test/cat-fast-food.png',
    1,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'c2222222-2222-4222-8222-222222222222'::uuid,
    NULL,
    'FOOD'::"ModuleType",
    'African',
    'african',
    'restaurant-outline',
    'https://cdn.daladrop.test/cat-african.png',
    2,
    TRUE,
    NOW(),
    NOW()
  )
ON CONFLICT DO NOTHING;

INSERT INTO menu_categories (
  id, store_id, name, description, sort_order, is_active, created_at, updated_at
)
VALUES (
  'a1111111-1111-4111-8111-111111111111'::uuid,
  'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,
  'Mains',
  'Hearty plates',
  1,
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO menu_items (
  id, store_id, menu_category_id, name, description, price_amount, currency,
  image_url, is_available, preparation_time, tags, sort_order, version,
  created_at, updated_at
)
VALUES (
  'a2222222-2222-4222-8222-222222222222'::uuid,
  'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,
  'a1111111-1111-4111-8111-111111111111'::uuid,
  'Chicken Burger',
  'Grilled chicken with fries',
  530,
  'KES',
  'https://cdn.daladrop.test/chicken-burger.png',
  TRUE,
  15,
  ARRAY['popular'],
  1,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET price_amount = 530, is_available = TRUE, updated_at = NOW();

INSERT INTO modifier_groups (
  id, menu_item_id, name, min_select, max_select, sort_order, created_at, updated_at
)
VALUES (
  'a3333333-3333-4333-8333-333333333333'::uuid,
  'a2222222-2222-4222-8222-222222222222'::uuid,
  'Extras',
  0,
  3,
  1,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO modifier_options (
  id, modifier_group_id, name, price_delta, currency, is_default, is_available,
  sort_order, created_at, updated_at
)
VALUES (
  'a4444444-4444-4444-8444-444444444444'::uuid,
  'a3333333-3333-4333-8333-333333333333'::uuid,
  'Extra cheese',
  50,
  'KES',
  FALSE,
  TRUE,
  1,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
