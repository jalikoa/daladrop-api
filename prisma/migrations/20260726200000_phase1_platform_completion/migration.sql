-- Phase 1 platform completion: ride ETA/surge/POD, notification preferences,
-- and admin RBAC for ops / transport catalog / feature flags / support / search.

ALTER TABLE "rides"
  ADD COLUMN IF NOT EXISTS "eta_minutes" SMALLINT,
  ADD COLUMN IF NOT EXISTS "surge_multiplier" DECIMAL(6, 3),
  ADD COLUMN IF NOT EXISTS "pod_photo_url" TEXT,
  ADD COLUMN IF NOT EXISTS "pod_signature_url" TEXT,
  ADD COLUMN IF NOT EXISTS "pod_notes" VARCHAR(500);

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "user_id" UUID NOT NULL,
  "push_enabled" BOOLEAN NOT NULL DEFAULT true,
  "email_enabled" BOOLEAN NOT NULL DEFAULT true,
  "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
  "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
  "categories" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "notification_preferences_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "permissions" ("id", "code", "resource", "action", "description", "created_at")
VALUES
  (gen_random_uuid(), 'ops.read', 'ops', 'read', 'View platform operations resources', NOW()),
  (gen_random_uuid(), 'ops.manage', 'ops', 'manage', 'Manage feature flags, announcements, and ops settings', NOW()),
  (gen_random_uuid(), 'transport.catalog.manage', 'transport', 'manage', 'Manage courier partners and inter-county routes', NOW()),
  (gen_random_uuid(), 'support.read', 'support', 'read', 'View support tickets', NOW()),
  (gen_random_uuid(), 'support.manage', 'support', 'manage', 'Manage support tickets', NOW()),
  (gen_random_uuid(), 'search.read', 'search', 'read', 'Access platform search APIs', NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('ADMIN', 'SUPPORT')
  AND p.code IN (
    'ops.read',
    'ops.manage',
    'transport.catalog.manage',
    'support.read',
    'support.manage',
    'search.read'
  )
ON CONFLICT DO NOTHING;
