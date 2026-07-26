-- Verticals: events + compliance admin permissions for ADMIN / SUPPORT.

INSERT INTO "permissions" ("id", "code", "resource", "action", "description", "created_at")
VALUES
  (gen_random_uuid(), 'events.read', 'events', 'read', 'View events, categories, ticket types, bookings', NOW()),
  (gen_random_uuid(), 'events.manage', 'events', 'manage', 'Create/update events, categories, ticket types', NOW()),
  (gen_random_uuid(), 'compliance.read', 'compliance', 'read', 'View age verification submissions', NOW()),
  (gen_random_uuid(), 'compliance.manage', 'compliance', 'manage', 'Review age verification submissions', NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('ADMIN', 'SUPPORT')
  AND p.code IN (
    'events.read',
    'events.manage',
    'compliance.read',
    'compliance.manage'
  )
ON CONFLICT DO NOTHING;
