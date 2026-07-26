-- Accounting Phase 2: admin permissions for double-entry posting & reports.

INSERT INTO "permissions" ("id", "code", "resource", "action", "description", "created_at")
VALUES
  (gen_random_uuid(), 'accounting.read', 'accounting', 'read', 'View charts, journals, periods, and financial reports', NOW()),
  (gen_random_uuid(), 'accounting.manage', 'accounting', 'manage', 'Create accounts, post/reverse journals, and manage periods', NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('ADMIN', 'SUPPORT', 'FINANCE')
  AND p.code IN ('accounting.read', 'accounting.manage')
ON CONFLICT DO NOTHING;
