-- Finance Phase 0 foundation: payment lifecycle, references, inbound webhooks,
-- provider configs, and idempotency ownership support.
-- Additive and idempotence-conscious (IF NOT EXISTS / DO $$ guards).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "PaymentLifecycleStatus" AS ENUM (
    'DRAFT',
    'PENDING',
    'AUTHORISED',
    'PROCESSING',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED',
    'EXPIRED',
    'REFUND_PENDING',
    'REFUNDED',
    'PARTIALLY_REFUNDED',
    'CHARGEBACK',
    'DISPUTED',
    'SETTLEMENT_PENDING',
    'SETTLED',
    'REVERSED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentReferenceType" AS ENUM (
    'INTERNAL',
    'CUSTOMER',
    'GATEWAY',
    'MERCHANT',
    'SETTLEMENT',
    'PROVIDER',
    'EXTERNAL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProviderConfigEnvironment" AS ENUM (
    'SANDBOX',
    'PRODUCTION'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InboundWebhookStatus" AS ENUM (
    'RECEIVED',
    'PROCESSED',
    'IGNORED',
    'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Payment additive columns (public PaymentStatus unchanged)
-- ---------------------------------------------------------------------------

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "lifecycle_status" "PaymentLifecycleStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ(6);

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "correlation_id" VARCHAR(64);

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "trace_id" VARCHAR(64);

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Backfill internal lifecycle from public status for existing rows.
UPDATE "payments"
SET "lifecycle_status" = CASE "status"::text
  WHEN 'PENDING' THEN 'PENDING'::"PaymentLifecycleStatus"
  WHEN 'PROCESSING' THEN 'PROCESSING'::"PaymentLifecycleStatus"
  WHEN 'SUCCESS' THEN 'SUCCEEDED'::"PaymentLifecycleStatus"
  WHEN 'FAILED' THEN 'FAILED'::"PaymentLifecycleStatus"
  WHEN 'CANCELLED' THEN 'CANCELLED'::"PaymentLifecycleStatus"
  WHEN 'REFUNDED' THEN 'REFUNDED'::"PaymentLifecycleStatus"
  WHEN 'PARTIALLY_REFUNDED' THEN 'PARTIALLY_REFUNDED'::"PaymentLifecycleStatus"
  ELSE "lifecycle_status"
END;
CREATE INDEX IF NOT EXISTS "payments_lifecycle_status_created_at_idx"
  ON "payments"("lifecycle_status", "created_at");

CREATE INDEX IF NOT EXISTS "payments_expires_at_idx"
  ON "payments"("expires_at");

CREATE INDEX IF NOT EXISTS "payments_correlation_id_idx"
  ON "payments"("correlation_id");

CREATE INDEX IF NOT EXISTS "payments_trace_id_idx"
  ON "payments"("trace_id");

-- ---------------------------------------------------------------------------
-- Payment references (provider-independent, uniqueness scoped by type+provider)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "payment_references" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_id" UUID NOT NULL,
  "type" "PaymentReferenceType" NOT NULL,
  "value" VARCHAR(191) NOT NULL,
  "provider" VARCHAR(32) NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_references_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "payment_references"
    ADD CONSTRAINT "payment_references_payment_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_references_type_provider_value_key"
  ON "payment_references"("type", "provider", "value");

CREATE INDEX IF NOT EXISTS "payment_references_payment_id_idx"
  ON "payment_references"("payment_id");

CREATE INDEX IF NOT EXISTS "payment_references_value_idx"
  ON "payment_references"("value");

-- ---------------------------------------------------------------------------
-- Provider configurations (secretRef only — never plaintext secrets)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "payment_provider_configs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(64) NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "environment" "ProviderConfigEnvironment" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB NOT NULL DEFAULT '{}',
  "secret_ref" VARCHAR(255) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_provider_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_configs_code_key"
  ON "payment_provider_configs"("code");

CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_configs_provider_env_version_key"
  ON "payment_provider_configs"("provider", "environment", "version");

CREATE INDEX IF NOT EXISTS "payment_provider_configs_provider_enabled_idx"
  ON "payment_provider_configs"("provider", "enabled");

-- ---------------------------------------------------------------------------
-- Inbound webhook receipt / replay dedup (outbound remains webhook_delivery_logs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "inbound_webhook_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" "PaymentProvider" NOT NULL,
  "event_id" VARCHAR(191) NOT NULL,
  "event_type" VARCHAR(128),
  "payload" JSONB NOT NULL,
  "headers" JSONB,
  "signature_valid" BOOLEAN,
  "status" "InboundWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
  "payment_id" UUID,
  "error_message" TEXT,
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inbound_webhook_events_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "inbound_webhook_events"
    ADD CONSTRAINT "inbound_webhook_events_payment_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "inbound_webhook_events_provider_event_id_key"
  ON "inbound_webhook_events"("provider", "event_id");

CREATE INDEX IF NOT EXISTS "inbound_webhook_events_status_received_at_idx"
  ON "inbound_webhook_events"("status", "received_at");

CREATE INDEX IF NOT EXISTS "inbound_webhook_events_payment_id_idx"
  ON "inbound_webhook_events"("payment_id");

-- ---------------------------------------------------------------------------
-- Idempotency store support for platform IdempotencyStore adapter
-- ---------------------------------------------------------------------------

ALTER TABLE "idempotency_records"
  ALTER COLUMN "key" TYPE VARCHAR(512);

ALTER TABLE "idempotency_records"
  ALTER COLUMN "method" SET DEFAULT '*';

ALTER TABLE "idempotency_records"
  ALTER COLUMN "path" SET DEFAULT '*';

ALTER TABLE "idempotency_records"
  ADD COLUMN IF NOT EXISTS "owner_token" VARCHAR(64);

CREATE INDEX IF NOT EXISTS "idempotency_records_owner_token_idx"
  ON "idempotency_records"("owner_token");
