# Operator migration guide

**Agents and automated tools must NOT apply these migrations to live databases.**

## Files

| Path | Purpose |
| --- | --- |
| `prisma/schema.prisma` | Source of truth for Prisma Client |
| `prisma/migrations/20260726120000_init_production_schema/` | Enums, tables, FKs, base indexes, extensions |
| `prisma/migrations/20260726120100_extensions_rls_indexes/` | CHECKs, partial uniques, PostGIS sync, immutability, RLS |
| `prisma/migrations/20260726130000_auth_mfa_security/` | MFA settings/factors/challenges + OTP resend metadata |
| `docs/database/validation/` | Post-apply read-only checks |
| `docs/database/seeds/001_chart_of_accounts.sql` | Legacy CoA/roles seed (superseded) |
| `docs/database/seeds/002_daladrop_pricing_and_policies.sql` | **Preferred** CoA + pricing bands + settlement policy |
| `docs/database/seeds/003_auth_test_user.sql` | Local demo user for auth curl smoke tests |
| `docs/database/01-schema-amendment-review.md` | Domain-first amend (payments, pricing, finance) |

## Prerequisites

1. PostgreSQL 15+ with **PostGIS** (Docker: `postgis/postgis:15-3.4` or managed PostGIS)
2. Roles able to `CREATE EXTENSION`
3. Backup / snapshot taken
4. Human review of SQL complete
5. Application downtime window agreed (greenfield: usually short)

## Apply (operator only)

```bash
# Review
less prisma/migrations/20260726120000_init_production_schema/migration.sql
less prisma/migrations/20260726120100_extensions_rls_indexes/migration.sql

# Apply via Prisma (preferred — records migration history)
npx prisma migrate deploy

# Or apply SQL manually in a transaction per file, then mark applied
```

If an old `scaffold_meta` table exists from the bootstrap schema, drop it before or after init (no FK dependents):

```sql
DROP TABLE IF EXISTS scaffold_meta;
```

## Rollback strategy

### Before any production data

```sql
-- Nuclear (empty environments only)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO CURRENT_USER;
-- re-create extensions as needed
```

### After init, before RLS migration

Restore from snapshot taken pre-deploy, or drop created tables in reverse FK order (costly — prefer snapshot).

### After RLS migration

```sql
-- Disable policies (example)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- Drop triggers/functions prefixed daladrop_
-- Drop partial indexes created in 20260726120100
```

Prefer **restore from PITR/snapshot** over hand-rolled downs for financial schemas.

## Downtime & compatibility

| Step | Expected downtime | Notes |
| --- | --- | --- |
| Init on empty DB | Seconds–minutes | No user traffic expected |
| RLS enable | Seconds | Ensure app sets `app.current_user_id` or uses BYPASSRLS role |
| PostGIS | Extension create | Fails on non-PostGIS images |

## Validation

```bash
psql "$DATABASE_URL" -f docs/database/validation/01-referential-integrity.sql
psql "$DATABASE_URL" -f docs/database/validation/02-financial-invariants.sql
psql "$DATABASE_URL" -f docs/database/validation/03-soft-delete-and-uniques.sql
psql "$DATABASE_URL" -f docs/database/validation/04-rls-smoke.sql
```

Expect empty result sets for anomaly queries (except informational counts).
