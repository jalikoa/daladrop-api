-- RC1 production hardening: session absolute expiry + refresh reuse detection,
-- payment/wallet/settlement idempotency uniqueness.

-- Sessions: absolute lifetime + previous refresh hash for reuse detection.
ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "previous_refresh_token_hash" CHAR(64),
  ADD COLUMN IF NOT EXISTS "absolute_expires_at" TIMESTAMPTZ(6);

UPDATE "sessions"
SET "absolute_expires_at" = COALESCE("absolute_expires_at", "expires_at")
WHERE "absolute_expires_at" IS NULL;

ALTER TABLE "sessions"
  ALTER COLUMN "absolute_expires_at" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "sessions_previous_refresh_token_hash_idx"
  ON "sessions" ("previous_refresh_token_hash");

-- Payments: unique idempotency key (NULLs remain allowed / distinct).
CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotency_key_key"
  ON "payments" ("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

-- Wallet transactions: one reference per wallet when set.
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_transactions_wallet_reference_key"
  ON "wallet_transactions" ("wallet_id", "reference")
  WHERE "reference" IS NOT NULL;

-- Settlements: one payout line per wallet per batch.
CREATE UNIQUE INDEX IF NOT EXISTS "settlements_batch_wallet_key"
  ON "settlements" ("batch_id", "wallet_id")
  WHERE "batch_id" IS NOT NULL;
