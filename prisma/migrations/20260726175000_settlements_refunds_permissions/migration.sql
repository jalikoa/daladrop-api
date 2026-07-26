-- Phase 5: admin permissions for the settlement batch engine.
-- Refunds stay gated behind the existing `payments.manage` permission.

INSERT INTO "permissions" ("id", "code", "resource", "action", "description", "created_at")
VALUES
  (gen_random_uuid(), 'settlements.read', 'settlements', 'read', 'View settlement policies, batches, and payouts', NOW()),
  (gen_random_uuid(), 'settlements.manage', 'settlements', 'manage', 'Create/approve/process/cancel settlement batches', NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('ADMIN', 'SUPPORT', 'FINANCE')
  AND p.code IN ('settlements.read', 'settlements.manage')
ON CONFLICT DO NOTHING;
