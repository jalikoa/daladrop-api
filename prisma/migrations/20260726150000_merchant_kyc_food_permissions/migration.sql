-- Merchant KYC + commerce admin permissions for food / restaurants.

CREATE TYPE "MerchantKycStatus" AS ENUM (
  'NOT_STARTED',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED'
);

CREATE TABLE "merchant_kyc" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "merchant_id" UUID NOT NULL,
  "status" "MerchantKycStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "business_registration_number" VARCHAR(128),
  "tax_pin" VARCHAR(64),
  "director_id_number" VARCHAR(64),
  "business_address" TEXT,
  "document_urls" JSONB NOT NULL DEFAULT '[]',
  "submitted_at" TIMESTAMPTZ(6),
  "reviewed_at" TIMESTAMPTZ(6),
  "reviewed_by" UUID,
  "review_notes" VARCHAR(1000),
  "rejection_reason" VARCHAR(500),
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "merchant_kyc_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "merchant_kyc_merchant_id_key" UNIQUE ("merchant_id"),
  CONSTRAINT "merchant_kyc_merchant_fkey"
    FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "merchant_kyc_status_submitted_at_idx"
  ON "merchant_kyc"("status", "submitted_at");

INSERT INTO "permissions" ("id", "code", "resource", "action", "description", "created_at")
VALUES
  (gen_random_uuid(), 'merchants.read', 'merchants', 'read', 'View merchants and stores', NOW()),
  (gen_random_uuid(), 'merchants.manage', 'merchants', 'manage', 'Create/update merchants, stores, hours', NOW()),
  (gen_random_uuid(), 'merchants.kyc', 'merchants', 'kyc', 'Review merchant KYC submissions', NOW()),
  (gen_random_uuid(), 'catalog.read', 'catalog', 'read', 'View menu and food categories', NOW()),
  (gen_random_uuid(), 'catalog.manage', 'catalog', 'manage', 'Manage menus, modifiers, food categories', NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('ADMIN', 'SUPPORT')
  AND p.code IN (
    'merchants.read',
    'merchants.manage',
    'merchants.kyc',
    'catalog.read',
    'catalog.manage'
  )
ON CONFLICT DO NOTHING;
