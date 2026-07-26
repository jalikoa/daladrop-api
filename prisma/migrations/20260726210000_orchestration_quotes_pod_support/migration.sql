-- Orchestration sprint: quotes, POD, expanded support tickets, ride REJECTED.

-- RideStatus.REJECTED
ALTER TYPE "RideStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- Support ticket status expansion
ALTER TYPE "SupportTicketStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "SupportTicketStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';
ALTER TYPE "SupportTicketStatus" ADD VALUE IF NOT EXISTS 'WAITING_MERCHANT';
ALTER TYPE "SupportTicketStatus" ADD VALUE IF NOT EXISTS 'ESCALATED';
ALTER TYPE "SupportTicketStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TABLE IF NOT EXISTS "pricing_quotes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "quote_type" VARCHAR(32) NOT NULL,
  "customer_id" UUID,
  "store_id" UUID,
  "service_type" VARCHAR(64),
  "currency" CHAR(3) NOT NULL DEFAULT 'KES',
  "subtotal_amount" BIGINT NOT NULL DEFAULT 0,
  "base_price_amount" BIGINT NOT NULL DEFAULT 0,
  "distance_fee_amount" BIGINT NOT NULL DEFAULT 0,
  "duration_fee_amount" BIGINT NOT NULL DEFAULT 0,
  "surge_amount" BIGINT NOT NULL DEFAULT 0,
  "peak_amount" BIGINT NOT NULL DEFAULT 0,
  "platform_fee_amount" BIGINT NOT NULL DEFAULT 0,
  "service_fee_amount" BIGINT NOT NULL DEFAULT 0,
  "tax_amount" BIGINT NOT NULL DEFAULT 0,
  "discount_amount" BIGINT NOT NULL DEFAULT 0,
  "coupon_amount" BIGINT NOT NULL DEFAULT 0,
  "wallet_credit_amount" BIGINT NOT NULL DEFAULT 0,
  "promotion_amount" BIGINT NOT NULL DEFAULT 0,
  "delivery_fee_amount" BIGINT NOT NULL DEFAULT 0,
  "total_amount" BIGINT NOT NULL,
  "merchant_earnings_amount" BIGINT NOT NULL DEFAULT 0,
  "rider_earnings_amount" BIGINT NOT NULL DEFAULT 0,
  "platform_revenue_amount" BIGINT NOT NULL DEFAULT 0,
  "distance_km" DECIMAL(8,3),
  "duration_minutes" INTEGER,
  "eta_minutes" INTEGER,
  "estimated_completion_at" TIMESTAMPTZ(6),
  "surge_multiplier" DECIMAL(6,3),
  "delivery_pricing_rule_id" UUID,
  "breakdown" JSONB,
  "request_snapshot" JSONB,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "consumed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "pricing_quotes_customer_id_created_at_idx"
  ON "pricing_quotes"("customer_id", "created_at");
CREATE INDEX IF NOT EXISTS "pricing_quotes_expires_at_idx"
  ON "pricing_quotes"("expires_at");
CREATE INDEX IF NOT EXISTS "pricing_quotes_quote_type_created_at_idx"
  ON "pricing_quotes"("quote_type", "created_at");

CREATE TABLE IF NOT EXISTS "proof_of_delivery" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" UUID UNIQUE,
  "ride_id" UUID UNIQUE,
  "photo_url" TEXT,
  "signature_url" TEXT,
  "recipient_name" VARCHAR(200),
  "notes" VARCHAR(500),
  "otp_code_hash" VARCHAR(128),
  "otp_verified_at" TIMESTAMPTZ(6),
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "confirmed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "confirmed_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "proof_of_delivery_order_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "proof_of_delivery_ride_fkey"
    FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "proof_of_delivery_confirmed_at_idx"
  ON "proof_of_delivery"("confirmed_at");

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "pricing_quote_id" UUID;
ALTER TABLE "rides"
  ADD COLUMN IF NOT EXISTS "pricing_quote_id" UUID;

DO $$ BEGIN
  ALTER TABLE "orders"
    ADD CONSTRAINT "orders_pricing_quote_fkey"
    FOREIGN KEY ("pricing_quote_id") REFERENCES "pricing_quotes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "rides"
    ADD CONSTRAINT "rides_pricing_quote_fkey"
    FOREIGN KEY ("pricing_quote_id") REFERENCES "pricing_quotes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "support_ticket_categories" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(120) NOT NULL UNIQUE,
  "description" TEXT,
  "sla_hours" INTEGER NOT NULL DEFAULT 24,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "merchant_id" UUID,
  ADD COLUMN IF NOT EXISTS "category_id" UUID,
  ADD COLUMN IF NOT EXISTS "merged_into_id" UUID,
  ADD COLUMN IF NOT EXISTS "sla_due_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "escalated_at" TIMESTAMPTZ(6);

DO $$ BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_category_fkey"
    FOREIGN KEY ("category_id") REFERENCES "support_ticket_categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "support_tickets_assigned_to_status_idx"
  ON "support_tickets"("assigned_to", "status");
CREATE INDEX IF NOT EXISTS "support_tickets_merchant_id_idx"
  ON "support_tickets"("merchant_id");

CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "is_internal" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "support_ticket_messages_ticket_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "support_ticket_messages_ticket_id_created_at_idx"
  ON "support_ticket_messages"("ticket_id", "created_at");

CREATE TABLE IF NOT EXISTS "support_ticket_attachments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" UUID NOT NULL,
  "message_id" UUID,
  "uploaded_by" UUID NOT NULL,
  "file_url" TEXT NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(128),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "support_ticket_attachments_ticket_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "support_ticket_attachments_ticket_id_idx"
  ON "support_ticket_attachments"("ticket_id");

INSERT INTO "support_ticket_categories" ("id", "name", "slug", "description", "sla_hours", "is_active")
VALUES
  (gen_random_uuid(), 'General', 'general', 'General customer support', 24, TRUE),
  (gen_random_uuid(), 'Payments', 'payments', 'Payment and refund issues', 12, TRUE),
  (gen_random_uuid(), 'Delivery', 'delivery', 'Delivery and rider issues', 8, TRUE),
  (gen_random_uuid(), 'Merchant', 'merchant', 'Merchant operational issues', 24, TRUE)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "permissions" ("id", "code", "resource", "action", "description", "created_at")
VALUES
  (gen_random_uuid(), 'quotes.read', 'quotes', 'read', 'View persisted pricing quotes', NOW()),
  (gen_random_uuid(), 'quotes.manage', 'quotes', 'manage', 'Manage pricing quotes', NOW()),
  (gen_random_uuid(), 'pod.read', 'pod', 'read', 'View proof of delivery', NOW()),
  (gen_random_uuid(), 'pod.manage', 'pod', 'manage', 'Submit and manage proof of delivery', NOW()),
  (gen_random_uuid(), 'search.manage', 'search', 'manage', 'Trigger search reindex jobs', NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('ADMIN', 'SUPPORT')
  AND p.code IN ('quotes.read', 'quotes.manage', 'pod.read', 'pod.manage', 'search.manage', 'support.read', 'support.manage')
ON CONFLICT DO NOTHING;
