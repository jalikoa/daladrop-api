-- Wallets Phase 3: admin permissions for liability wallets & escrow ops.

INSERT INTO "permissions" ("id", "code", "resource", "action", "description", "created_at")
VALUES
  (gen_random_uuid(), 'wallets.read', 'wallets', 'read', 'View wallets, transactions, and escrow holds', NOW()),
  (gen_random_uuid(), 'wallets.manage', 'wallets', 'manage', 'Credit/debit/hold/release/adjust wallets and release/forfeit escrow', NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('ADMIN', 'SUPPORT', 'FINANCE')
  AND p.code IN ('wallets.read', 'wallets.manage')
ON CONFLICT DO NOTHING;
