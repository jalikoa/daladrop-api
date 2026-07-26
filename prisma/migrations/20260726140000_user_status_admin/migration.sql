-- User status extensions for freeze / restrict + admin audit fields.

ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'RESTRICTED';

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "status_reason" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "status_changed_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "status_changed_by" UUID;

-- Admin user-management permissions
INSERT INTO "permissions" ("id", "code", "resource", "action", "description", "created_at")
VALUES
  (gen_random_uuid(), 'users.read', 'users', 'read', 'List and view user accounts', NOW()),
  (gen_random_uuid(), 'users.manage', 'users', 'manage', 'Freeze, restrict, and restore user accounts', NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "roles" ("id", "code", "name", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'ADMIN', 'Admin', 'Platform administrator', NOW(), NOW()),
  (gen_random_uuid(), 'SUPPORT', 'Support', 'Customer support', NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('ADMIN', 'SUPPORT')
  AND p.code IN ('users.read', 'users.manage')
ON CONFLICT DO NOTHING;
