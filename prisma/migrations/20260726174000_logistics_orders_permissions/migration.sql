-- Logistics + Orders Phase 4: admin permissions for delivery pricing and order ops.

INSERT INTO "permissions" ("id", "code", "resource", "action", "description", "created_at")
VALUES
  (gen_random_uuid(), 'logistics.read', 'logistics', 'read', 'View delivery pricing rules and constraints', NOW()),
  (gen_random_uuid(), 'logistics.manage', 'logistics', 'manage', 'Create/update delivery pricing rules and constraints', NOW()),
  (gen_random_uuid(), 'orders.read', 'orders', 'read', 'View commerce orders across modules', NOW()),
  (gen_random_uuid(), 'orders.manage', 'orders', 'manage', 'Update order status and admin fulfilment actions', NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('ADMIN', 'SUPPORT', 'FINANCE')
  AND p.code IN ('logistics.read', 'logistics.manage', 'orders.read', 'orders.manage')
ON CONFLICT DO NOTHING;
