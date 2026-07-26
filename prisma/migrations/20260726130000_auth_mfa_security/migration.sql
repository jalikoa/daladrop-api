-- Auth/MFA security additions.
-- Generated only; operators apply after review.

CREATE TYPE "MfaMethod" AS ENUM ('TOTP', 'EMAIL', 'SMS');
CREATE TYPE "MfaFactorStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

ALTER TABLE "otp_challenges"
  ADD COLUMN "verified_at" TIMESTAMPTZ(6),
  ADD COLUMN "sent_at" TIMESTAMPTZ(6),
  ADD COLUMN "resend_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "delivery_job_id" VARCHAR(128);

CREATE TABLE "user_security_settings" (
  "user_id" UUID NOT NULL,
  "mfa_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "preferred_mfa_method" "MfaMethod",
  "require_mfa_for_sensitive_actions" BOOLEAN NOT NULL DEFAULT FALSE,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "user_security_settings_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "mfa_factors" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "method" "MfaMethod" NOT NULL,
  "status" "MfaFactorStatus" NOT NULL DEFAULT 'PENDING',
  "label" VARCHAR(100),
  "secret_encrypted" TEXT,
  "delivery_identifier" VARCHAR(255),
  "verified_at" TIMESTAMPTZ(6),
  "last_used_at" TIMESTAMPTZ(6),
  "disabled_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mfa_recovery_codes" (
  "id" UUID NOT NULL,
  "factor_id" UUID NOT NULL,
  "code_hash" CHAR(64) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mfa_login_challenges" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "factor_id" UUID NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "consumed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_login_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mfa_factors_user_id_status_idx"
  ON "mfa_factors"("user_id", "status");
CREATE INDEX "mfa_factors_user_id_method_idx"
  ON "mfa_factors"("user_id", "method");
CREATE UNIQUE INDEX "mfa_recovery_codes_code_hash_key"
  ON "mfa_recovery_codes"("code_hash");
CREATE INDEX "mfa_recovery_codes_factor_id_used_at_idx"
  ON "mfa_recovery_codes"("factor_id", "used_at");
CREATE INDEX "mfa_login_challenges_user_id_created_at_idx"
  ON "mfa_login_challenges"("user_id", "created_at");
CREATE INDEX "mfa_login_challenges_expires_at_idx"
  ON "mfa_login_challenges"("expires_at");

ALTER TABLE "user_security_settings"
  ADD CONSTRAINT "user_security_settings_user_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mfa_factors"
  ADD CONSTRAINT "mfa_factors_user_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mfa_recovery_codes"
  ADD CONSTRAINT "mfa_recovery_codes_factor_fkey"
  FOREIGN KEY ("factor_id") REFERENCES "mfa_factors"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mfa_login_challenges"
  ADD CONSTRAINT "mfa_login_challenges_user_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mfa_login_challenges"
  ADD CONSTRAINT "mfa_login_challenges_factor_fkey"
  FOREIGN KEY ("factor_id") REFERENCES "mfa_factors"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_security_settings"
  ADD CONSTRAINT "user_security_settings_preferred_method_chk"
  CHECK (
    "mfa_enabled" = FALSE
    OR "preferred_mfa_method" IS NOT NULL
  );

ALTER TABLE "mfa_factors"
  ADD CONSTRAINT "mfa_factors_secret_or_destination_chk"
  CHECK (
    ("method" = 'TOTP' AND "secret_encrypted" IS NOT NULL)
    OR ("method" IN ('EMAIL', 'SMS') AND "delivery_identifier" IS NOT NULL)
  );
