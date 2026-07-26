-- Local auth smoke-test user.
-- Run AFTER migrations and roles seed.
-- Password (plain): TestPass123!@#
-- Bcrypt cost 12 hash below matches PasswordService defaults.

INSERT INTO users (
  id,
  email,
  phone,
  phone_e164,
  first_name,
  last_name,
  display_name,
  status,
  email_verified_at,
  phone_verified_at,
  version,
  created_at,
  updated_at
)
VALUES (
  '11111111-1111-4111-8111-111111111111'::uuid,
  'demo@daladrop.test',
  '0712345678',
  '254712345678',
  'Demo',
  'Customer',
  'Demo Customer',
  'ACTIVE'::"UserStatus",
  NOW(),
  NOW(),
  0,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  phone_e164 = EXCLUDED.phone_e164,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  display_name = EXCLUDED.display_name,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO user_credentials (
  id,
  user_id,
  password_hash,
  algorithm,
  password_set_at,
  created_at,
  updated_at
)
VALUES (
  '22222222-2222-4222-8222-222222222222'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  '$2b$12$lw6XnuUhDm5I4b4Ggqt9bOe77NYWBY1YBlyXcMZzEV4H6LFCnWDh.',
  'bcrypt',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  password_set_at = NOW(),
  updated_at = NOW();

INSERT INTO user_security_settings (
  user_id,
  mfa_enabled,
  preferred_mfa_method,
  require_mfa_for_sensitive_actions,
  version,
  created_at,
  updated_at
)
VALUES (
  '11111111-1111-4111-8111-111111111111'::uuid,
  FALSE,
  NULL,
  FALSE,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_roles (id, user_id, role_id, assigned_at)
SELECT
  '33333333-3333-4333-8333-333333333333'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  roles.id,
  NOW()
FROM roles
WHERE roles.code = 'CUSTOMER'::"RoleCode"
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO legal_acceptances (
  id,
  user_id,
  document_type,
  version,
  full_name,
  signature_name,
  accepted_at
)
VALUES
  (
    '44444444-4444-4444-8444-444444444441'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'TERMS',
    'customer-terms-2026-05-25',
    'Demo Customer',
    'Demo Customer',
    NOW()
  ),
  (
    '44444444-4444-4444-8444-444444444442'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'PRIVACY',
    'customer-privacy-2026-05-25',
    'Demo Customer',
    'Demo Customer',
    NOW()
  )
ON CONFLICT (id) DO NOTHING;
