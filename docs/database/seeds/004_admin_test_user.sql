-- Admin smoke-test user (password: TestPass123!@# — same bcrypt as demo customer).
-- Requires migration 20260726140000_user_status_admin (permissions seeded).

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
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'admin@daladrop.test',
  '0799999999',
  '254799999999',
  'Admin',
  'Operator',
  'Admin Operator',
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
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  '$2b$12$lw6XnuUhDm5I4b4Ggqt9bOe77NYWBY1YBlyXcMZzEV4H6LFCnWDh.',
  'bcrypt',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
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
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
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
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  roles.id,
  NOW()
FROM roles
WHERE roles.code = 'ADMIN'::"RoleCode"
ON CONFLICT (user_id, role_id) DO NOTHING;
