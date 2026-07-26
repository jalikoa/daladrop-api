-- Module 15 (Notifications): admin permissions for broadcast + oversight.
-- Named "search_permissions" to slot alongside the other Module 15-18 gap
-- migrations; notifications don't ship a search endpoint yet but the
-- permission grants land here so RBAC doesn't need a follow-up migration.

INSERT INTO "permissions" ("id", "code", "resource", "action", "description", "created_at")
VALUES
  (gen_random_uuid(), 'notifications.read', 'notifications', 'read', 'View in-app notifications for oversight/support', NOW()),
  (gen_random_uuid(), 'notifications.manage', 'notifications', 'manage', 'Broadcast and manage in-app notifications', NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('ADMIN', 'SUPPORT')
  AND p.code IN ('notifications.read', 'notifications.manage')
ON CONFLICT DO NOTHING;
