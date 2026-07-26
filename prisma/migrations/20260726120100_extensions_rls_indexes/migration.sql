-- ============================================================================
-- Migration: extensions hardening, constraints, spatial indexes, RLS
-- Generated: 2026-07-26 — DO NOT auto-apply from CI agents against live DBs
-- Prerequisites: 20260726120000_init_production_schema applied
-- Requires: PostGIS-capable PostgreSQL (postgis/postgis:15+ or cloud PostGIS)
-- Downtime: low (CREATE INDEX CONCURRENTLY preferred in production — see notes)
-- Rollback: see docs/database/00-architecture-review.md §12
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CHECK CONSTRAINTS (business invariants)
-- ---------------------------------------------------------------------------

ALTER TABLE "journal_lines"
  ADD CONSTRAINT "journal_lines_amount_nonneg_chk"
  CHECK ("debit_amount" >= 0 AND "credit_amount" >= 0);

ALTER TABLE "journal_lines"
  ADD CONSTRAINT "journal_lines_debit_xor_credit_chk"
  CHECK (
    ("debit_amount" > 0 AND "credit_amount" = 0)
    OR ("credit_amount" > 0 AND "debit_amount" = 0)
  );

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_positive_chk"
  CHECK ("amount" > 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_totals_nonneg_chk"
  CHECK (
    "subtotal_amount" >= 0
    AND "delivery_fee_amount" >= 0
    AND "service_fee_amount" >= 0
    AND "total_amount" >= 0
  );

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_score_range_chk"
  CHECK ("score" >= 1 AND "score" <= 5);

ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_balance_nonneg_chk"
  CHECK ("balance_amount" >= 0 AND "hold_amount" >= 0);

ALTER TABLE "event_ticket_types"
  ADD CONSTRAINT "event_ticket_types_qty_chk"
  CHECK ("total_qty" >= 0 AND "sold_qty" >= 0 AND "sold_qty" <= "total_qty");

ALTER TABLE "modifier_groups"
  ADD CONSTRAINT "modifier_groups_select_chk"
  CHECK ("min_select" >= 0 AND "max_select" >= "min_select");

ALTER TABLE "delivery_pricing_rules"
  ADD CONSTRAINT "delivery_pricing_rules_split_chk"
  CHECK ("customer_charge" = "rider_pay" + "platform_commission");

ALTER TABLE "delivery_pricing_rules"
  ADD CONSTRAINT "delivery_pricing_rules_distance_chk"
  CHECK ("distance_min_km" >= 0 AND "distance_max_km" > "distance_min_km");

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_debit_xor_credit_chk"
  CHECK (
    ("debit_amount" > 0 AND "credit_amount" = 0)
    OR ("credit_amount" > 0 AND "debit_amount" = 0)
  );

-- ---------------------------------------------------------------------------
-- PARTIAL UNIQUE INDEXES (soft-delete aware)
-- Prisma cannot express these natively on 5.22
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_active_uq"
  ON "users" (LOWER("email"))
  WHERE "email" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_e164_active_uq"
  ON "users" ("phone_e164")
  WHERE "phone_e164" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "stores_slug_active_uq"
  ON "stores" ("slug")
  WHERE "slug" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "categories_module_slug_global_uq"
  ON "categories" ("module_type", "slug")
  WHERE "store_id" IS NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "carts_user_module_store_uq"
  ON "carts" ("user_id", "module_type", COALESCE("store_id", '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS "orders_unpaid_partial_idx"
  ON "orders" ("created_at")
  WHERE "payment_status" IN ('PENDING', 'PROCESSING') AND "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "rides_searching_partial_idx"
  ON "rides" ("created_at")
  WHERE "status" = 'SEARCHING' AND "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "products_active_instock_partial_idx"
  ON "products" ("store_id", "price_amount")
  WHERE "is_active" = TRUE AND "in_stock" = TRUE AND "deleted_at" IS NULL;

-- ---------------------------------------------------------------------------
-- SPATIAL: keep geography in sync with lat/lng + GIST indexes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION daladrop_set_geog_point()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude::float8, NEW.latitude::float8), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION daladrop_set_ride_geog()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.pickup_location := ST_SetSRID(
    ST_MakePoint(NEW.pickup_longitude::float8, NEW.pickup_latitude::float8), 4326
  )::geography;
  NEW.dropoff_location := ST_SetSRID(
    ST_MakePoint(NEW.dropoff_longitude::float8, NEW.dropoff_latitude::float8), 4326
  )::geography;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION daladrop_set_rider_geog()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.current_latitude IS NOT NULL AND NEW.current_longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(
      ST_MakePoint(NEW.current_longitude::float8, NEW.current_latitude::float8), 4326
    )::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stores_set_geog ON "stores";
CREATE TRIGGER trg_stores_set_geog
  BEFORE INSERT OR UPDATE OF latitude, longitude ON "stores"
  FOR EACH ROW EXECUTE FUNCTION daladrop_set_geog_point();

DROP TRIGGER IF EXISTS trg_events_set_geog ON "events";
CREATE TRIGGER trg_events_set_geog
  BEFORE INSERT OR UPDATE OF latitude, longitude ON "events"
  FOR EACH ROW EXECUTE FUNCTION daladrop_set_geog_point();

DROP TRIGGER IF EXISTS trg_rides_set_geog ON "rides";
CREATE TRIGGER trg_rides_set_geog
  BEFORE INSERT OR UPDATE OF pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude ON "rides"
  FOR EACH ROW EXECUTE FUNCTION daladrop_set_ride_geog();

DROP TRIGGER IF EXISTS trg_riders_set_geog ON "riders";
CREATE TRIGGER trg_riders_set_geog
  BEFORE INSERT OR UPDATE OF current_latitude, current_longitude ON "riders"
  FOR EACH ROW EXECUTE FUNCTION daladrop_set_rider_geog();

CREATE INDEX IF NOT EXISTS "stores_location_gix" ON "stores" USING GIST ("location");
CREATE INDEX IF NOT EXISTS "events_location_gix" ON "events" USING GIST ("location");
CREATE INDEX IF NOT EXISTS "rides_pickup_location_gix" ON "rides" USING GIST ("pickup_location");
CREATE INDEX IF NOT EXISTS "rides_dropoff_location_gix" ON "rides" USING GIST ("dropoff_location");
CREATE INDEX IF NOT EXISTS "riders_location_gix" ON "riders" USING GIST ("location");

-- Optional trigram search (requires pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "stores_name_trgm_idx" ON "stores" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "products_name_trgm_idx" ON "products" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "menu_items_name_trgm_idx" ON "menu_items" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "events_name_trgm_idx" ON "events" USING GIN ("name" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- IMMUTABILITY GUARDS (append-only financial + audit)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION daladrop_forbid_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only; mutations are forbidden', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_lines_immutable ON "journal_lines";
CREATE TRIGGER trg_journal_lines_immutable
  BEFORE UPDATE OR DELETE ON "journal_lines"
  FOR EACH ROW EXECUTE FUNCTION daladrop_forbid_mutation();

DROP TRIGGER IF EXISTS trg_audit_records_immutable ON "audit_records";
CREATE TRIGGER trg_audit_records_immutable
  BEFORE UPDATE OR DELETE ON "audit_records"
  FOR EACH ROW EXECUTE FUNCTION daladrop_forbid_mutation();

DROP TRIGGER IF EXISTS trg_wallet_transactions_immutable ON "wallet_transactions";
CREATE TRIGGER trg_wallet_transactions_immutable
  BEFORE UPDATE OR DELETE ON "wallet_transactions"
  FOR EACH ROW EXECUTE FUNCTION daladrop_forbid_mutation();

DROP TRIGGER IF EXISTS trg_legal_acceptances_immutable ON "legal_acceptances";
CREATE TRIGGER trg_legal_acceptances_immutable
  BEFORE UPDATE OR DELETE ON "legal_acceptances"
  FOR EACH ROW EXECUTE FUNCTION daladrop_forbid_mutation();

-- Posted journal headers: allow only status transitions DRAFT->POSTED / POSTED->VOIDED via app,
-- but block amount-related column changes by restricting UPDATE of entry_number after insert.
CREATE OR REPLACE FUNCTION daladrop_protect_posted_journal()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'POSTED' AND NEW.status = 'POSTED' THEN
    IF NEW.entry_number IS DISTINCT FROM OLD.entry_number
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.payment_id IS DISTINCT FROM OLD.payment_id THEN
      RAISE EXCEPTION 'Posted journal entry fields are immutable'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;
  IF OLD.status = 'VOIDED' THEN
    RAISE EXCEPTION 'Voided journal entries cannot be modified'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_entries_protect ON "journal_entries";
CREATE TRIGGER trg_journal_entries_protect
  BEFORE UPDATE ON "journal_entries"
  FOR EACH ROW EXECUTE FUNCTION daladrop_protect_posted_journal();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY (Supabase-compatible via auth.uid() when present;
-- falls back to app.current_user_id GUC for self-hosted NestJS)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION daladrop_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
    NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );
$$;

CREATE OR REPLACE FUNCTION daladrop_current_roles()
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    string_to_array(NULLIF(current_setting('app.current_roles', true), ''), ','),
    ARRAY[]::text[]
  );
$$;

CREATE OR REPLACE FUNCTION daladrop_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT daladrop_current_roles() && ARRAY['ADMIN','SUPPORT','FINANCE','SYSTEM'];
$$;

-- Enable RLS on tenant-sensitive tables
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_places" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "menu_favourites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallet_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "merchants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "age_verifications" ENABLE ROW LEVEL SECURITY;

-- Users: self or staff
DROP POLICY IF EXISTS users_self_select ON "users";
CREATE POLICY users_self_select ON "users"
  FOR SELECT USING (id = daladrop_current_user_id() OR daladrop_is_staff());

DROP POLICY IF EXISTS users_self_update ON "users";
CREATE POLICY users_self_update ON "users"
  FOR UPDATE USING (id = daladrop_current_user_id() OR daladrop_is_staff());

-- Sessions: owner only
DROP POLICY IF EXISTS sessions_owner ON "sessions";
CREATE POLICY sessions_owner ON "sessions"
  FOR ALL USING ("user_id" = daladrop_current_user_id() OR daladrop_is_staff());

-- Orders: customer, related merchant owner, assigned rider, or staff
DROP POLICY IF EXISTS orders_access ON "orders";
CREATE POLICY orders_access ON "orders"
  FOR SELECT USING (
    daladrop_is_staff()
    OR "customer_id" = daladrop_current_user_id()
    OR EXISTS (
      SELECT 1 FROM "stores" s
      JOIN "merchants" m ON m.id = s.merchant_id
      WHERE s.id = "orders"."store_id" AND m.owner_user_id = daladrop_current_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM "riders" r
      WHERE r.id = "orders"."rider_id" AND r.user_id = daladrop_current_user_id()
    )
  );

-- Rides: customer, assigned rider, staff
DROP POLICY IF EXISTS rides_access ON "rides";
CREATE POLICY rides_access ON "rides"
  FOR SELECT USING (
    daladrop_is_staff()
    OR "customer_id" = daladrop_current_user_id()
    OR EXISTS (
      SELECT 1 FROM "riders" r
      WHERE r.id = "rides"."rider_id" AND r.user_id = daladrop_current_user_id()
    )
  );

-- Payments: linked customer or staff (finance)
DROP POLICY IF EXISTS payments_access ON "payments";
CREATE POLICY payments_access ON "payments"
  FOR SELECT USING (
    daladrop_is_staff()
    OR "customer_id" = daladrop_current_user_id()
  );

-- Notifications / places / favourites: owner
DROP POLICY IF EXISTS notifications_owner ON "notifications";
CREATE POLICY notifications_owner ON "notifications"
  FOR ALL USING ("user_id" = daladrop_current_user_id() OR daladrop_is_staff());

DROP POLICY IF EXISTS saved_places_owner ON "saved_places";
CREATE POLICY saved_places_owner ON "saved_places"
  FOR ALL USING ("user_id" = daladrop_current_user_id() OR daladrop_is_staff());

DROP POLICY IF EXISTS saved_items_owner ON "saved_items";
CREATE POLICY saved_items_owner ON "saved_items"
  FOR ALL USING ("user_id" = daladrop_current_user_id() OR daladrop_is_staff());

DROP POLICY IF EXISTS menu_favourites_owner ON "menu_favourites";
CREATE POLICY menu_favourites_owner ON "menu_favourites"
  FOR ALL USING ("user_id" = daladrop_current_user_id() OR daladrop_is_staff());

DROP POLICY IF EXISTS event_bookings_access ON "event_bookings";
CREATE POLICY event_bookings_access ON "event_bookings"
  FOR SELECT USING (
    daladrop_is_staff()
    OR "customer_id" = daladrop_current_user_id()
  );

DROP POLICY IF EXISTS age_verifications_owner ON "age_verifications";
CREATE POLICY age_verifications_owner ON "age_verifications"
  FOR ALL USING ("user_id" = daladrop_current_user_id() OR daladrop_is_staff());

-- Wallets: owner variants or staff/finance
DROP POLICY IF EXISTS wallets_access ON "wallets";
CREATE POLICY wallets_access ON "wallets"
  FOR SELECT USING (
    daladrop_is_staff()
    OR "user_id" = daladrop_current_user_id()
    OR EXISTS (SELECT 1 FROM "merchants" m WHERE m.id = "wallets"."merchant_id" AND m.owner_user_id = daladrop_current_user_id())
    OR EXISTS (SELECT 1 FROM "riders" r WHERE r.id = "wallets"."rider_id" AND r.user_id = daladrop_current_user_id())
    OR EXISTS (SELECT 1 FROM "event_organizers" o WHERE o.id = "wallets"."organizer_id" AND o.user_id = daladrop_current_user_id())
  );

DROP POLICY IF EXISTS wallet_tx_access ON "wallet_transactions";
CREATE POLICY wallet_tx_access ON "wallet_transactions"
  FOR SELECT USING (
    daladrop_is_staff()
    OR EXISTS (
      SELECT 1 FROM "wallets" w
      WHERE w.id = "wallet_transactions"."wallet_id"
        AND (
          w.user_id = daladrop_current_user_id()
          OR EXISTS (SELECT 1 FROM "merchants" m WHERE m.id = w.merchant_id AND m.owner_user_id = daladrop_current_user_id())
          OR EXISTS (SELECT 1 FROM "riders" r WHERE r.id = w.rider_id AND r.user_id = daladrop_current_user_id())
        )
    )
  );

-- Merchants / stores: public read of active; owners manage
DROP POLICY IF EXISTS merchants_public_read ON "merchants";
CREATE POLICY merchants_public_read ON "merchants"
  FOR SELECT USING (
    daladrop_is_staff()
    OR "status" = 'ACTIVE'
    OR "owner_user_id" = daladrop_current_user_id()
  );

DROP POLICY IF EXISTS merchants_owner_write ON "merchants";
CREATE POLICY merchants_owner_write ON "merchants"
  FOR ALL USING ("owner_user_id" = daladrop_current_user_id() OR daladrop_is_staff());

DROP POLICY IF EXISTS stores_public_read ON "stores";
CREATE POLICY stores_public_read ON "stores"
  FOR SELECT USING (
    daladrop_is_staff()
    OR ("is_active" = TRUE AND "deleted_at" IS NULL)
    OR EXISTS (
      SELECT 1 FROM "merchants" m
      WHERE m.id = "stores"."merchant_id" AND m.owner_user_id = daladrop_current_user_id()
    )
  );

DROP POLICY IF EXISTS stores_owner_write ON "stores";
CREATE POLICY stores_owner_write ON "stores"
  FOR ALL USING (
    daladrop_is_staff()
    OR EXISTS (
      SELECT 1 FROM "merchants" m
      WHERE m.id = "stores"."merchant_id" AND m.owner_user_id = daladrop_current_user_id()
    )
  );

-- NOTE: NestJS service role should use a DB role that BYPASSRLS or SET ROLE
-- after setting app.current_user_id for user-scoped connections.
-- Journal / CoA tables intentionally have RLS disabled for service-role writers;
-- expose via Finance-only application APIs, not direct client access.

COMMENT ON FUNCTION daladrop_current_user_id() IS
  'Resolves caller UUID from Supabase JWT sub or app.current_user_id GUC';
