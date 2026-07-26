-- Finance Phase 1: native KopoKopo provider + payments permissions.

DO $$ BEGIN
  ALTER TYPE "PaymentProvider" ADD VALUE 'KOPOKOPO';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN
    IF SQLERRM NOT ILIKE '%already exists%' THEN
      RAISE;
    END IF;
END $$;

INSERT INTO "permissions" ("id", "code", "resource", "action", "description", "created_at")
VALUES
  (gen_random_uuid(), 'payments.read', 'payments', 'read', 'View payments and provider transactions', NOW()),
  (gen_random_uuid(), 'payments.manage', 'payments', 'manage', 'Approve, reverse, refund, and administer payments', NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('ADMIN', 'SUPPORT', 'FINANCE')
  AND p.code IN ('payments.read', 'payments.manage')
ON CONFLICT DO NOTHING;
