-- Optional seed: Chart of Accounts (KES) + baseline roles
-- Run AFTER migrations. Idempotent via ON CONFLICT DO NOTHING on unique codes.

INSERT INTO accounts (id, code, name, account_type, normal_balance, currency, is_system, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid(), '1000', 'Platform Cash (M-Pesa)', 'ASSET'::"AccountType", 'DEBIT'::"NormalBalance", 'KES', TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), '1100', 'Customer Wallets', 'LIABILITY'::"AccountType", 'CREDIT'::"NormalBalance", 'KES', TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), '1200', 'Escrow — Commerce', 'LIABILITY'::"AccountType", 'CREDIT'::"NormalBalance", 'KES', TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), '1300', 'Escrow — Rides', 'LIABILITY'::"AccountType", 'CREDIT'::"NormalBalance", 'KES', TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), '2000', 'Merchant Payables', 'LIABILITY'::"AccountType", 'CREDIT'::"NormalBalance", 'KES', TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), '2100', 'Rider Payables', 'LIABILITY'::"AccountType", 'CREDIT'::"NormalBalance", 'KES', TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), '2200', 'Organizer Payables', 'LIABILITY'::"AccountType", 'CREDIT'::"NormalBalance", 'KES', TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), '4000', 'Service Fee Revenue', 'REVENUE'::"AccountType", 'CREDIT'::"NormalBalance", 'KES', TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), '4100', 'Delivery Fee Revenue', 'REVENUE'::"AccountType", 'CREDIT'::"NormalBalance", 'KES', TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), '4200', 'Ticket Platform Fee Revenue', 'REVENUE'::"AccountType", 'CREDIT'::"NormalBalance", 'KES', TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), '5000', 'Refunds & Chargebacks', 'EXPENSE'::"AccountType", 'DEBIT'::"NormalBalance", 'KES', TRUE, TRUE, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (id, code, name, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'CUSTOMER'::"RoleCode", 'Customer', 'End customer', NOW(), NOW()),
  (gen_random_uuid(), 'RIDER'::"RoleCode", 'Rider', 'Delivery / ride partner', NOW(), NOW()),
  (gen_random_uuid(), 'MERCHANT_OWNER'::"RoleCode", 'Merchant Owner', 'Store owner', NOW(), NOW()),
  (gen_random_uuid(), 'MERCHANT_STAFF'::"RoleCode", 'Merchant Staff', 'Store staff', NOW(), NOW()),
  (gen_random_uuid(), 'ORGANIZER'::"RoleCode", 'Event Organizer', 'Events host', NOW(), NOW()),
  (gen_random_uuid(), 'ADMIN'::"RoleCode", 'Admin', 'Platform admin', NOW(), NOW()),
  (gen_random_uuid(), 'SUPPORT'::"RoleCode", 'Support', 'Customer support', NOW(), NOW()),
  (gen_random_uuid(), 'FINANCE'::"RoleCode", 'Finance', 'Finance operations', NOW(), NOW()),
  (gen_random_uuid(), 'SYSTEM'::"RoleCode", 'System', 'Service account', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;
