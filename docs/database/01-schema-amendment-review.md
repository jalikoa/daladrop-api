# Schema amendment review — domain-first commerce / logistics / finance

**Date:** 2026-07-26  
**Safety:** Migrations regenerated but **not executed**. `.env` untouched.

---

## 1. Database schema improvements

| Area | Before (debt) | After |
| --- | --- | --- |
| Payments | M-Pesa columns on `payments` | Provider-agnostic `Payment` + `PaymentProviderTransaction` |
| Pricing | `AppPricingConfig` JSON blob | `DeliveryPricingRule` + `DeliveryConstraint` + `ParcelPricingProfile` (versioned) |
| Rider pay | Implied balance bump | Snapshots on Order/Ride + journal + wallet debit/credit + `SettlementPolicy` |
| Gas | `sizeLabel` string only | `CylinderType` + gas pricing rules + `CylinderExchange` |
| Liquor commissions | Nowhere | `MerchantContract` (fixed / % / hybrid) |
| Events | Parallel payment path | `Event.merchantId`, ticket→`Product`, booking→`Order` |
| Audit | `entity_audit_logs` | `audit_records` (`AuditRecord`) |
| Accounting | Accounts only | CoA, fiscal/accounting periods, balances, financial docs, tax ledger |
| Multi-currency | Currency only | `currency` + `baseCurrency` + `exchangeRate` on money tables |

Money remains **BIGINT minor units** (seed uses whole KES integers; align app `Money` scale explicitly).

---

## 2. New tables required

| Table | Why |
| --- | --- |
| `payment_provider_transactions` | Isolate Daraja/Stripe/etc. from core Payment |
| `delivery_constraints` | Configurable 9km / 9kg / 40×40×30 (and overflow to parcel) |
| `delivery_pricing_rules` | Editable customer/rider/platform bands |
| `parcel_pricing_profiles` | Parcel / express / intercounty / insurance rules |
| `cylinder_types` | Gas product taxonomy for pricing |
| `cylinder_exchanges` | Empty cylinder handover audit |
| `merchant_contracts` | Per-merchant commission agreements |
| `settlement_policies` | Friday 16:30 as data, not code |
| `settlements` | Per-wallet payout with payout provider |
| `charts_of_accounts` | Named CoA containers |
| `fiscal_periods` / `accounting_periods` / `account_balances` | Period close & trial balance |
| `financial_documents` | Invoice / receipt / credit / debit notes |
| `tax_ledger` | Tax reporting lines |
| `audit_records` | Renamed immutable entity audit |

---

## 3. Modified existing tables

| Table | Change | Justification |
| --- | --- | --- |
| `payments` | Removed `mpesa_*`, `checkout_request_id`, `gateway_payload`; added `provider`, `reference`, `initiatedAt`, `completedAt`, FX fields | Core domain must not encode Daraja |
| `rides` | Removed `mpesaPhone`; added pricing snapshots, package dims, parcel profile FK | Payer phone lives on provider tx `payerIdentifier` |
| `orders` | Pricing rule/constraint FKs; rider/platform/merchant commission snapshots; package dims; FX | Preserve quote-time economics forever |
| `products` | `cylinderTypeId`, dimensions | Gas + parcel constraint evaluation |
| `merchants` | `isOrganizer` | Events as merchants |
| `events` | Required `merchantId`; organizer optional | Settlement via merchant wallet |
| `event_ticket_types` | Optional `productId` | Tickets as products |
| `event_bookings` | Optional `orderId` | Shared checkout/payment |
| `wallets` | Added `ownerId`; keep typed FKs | Liability model + query convenience |
| `wallet_transactions` | `debitAmount` / `creditAmount` / `reference` | Double-entry style mirror |
| `accounts` | Belongs to `charts_of_accounts` | Multi-chart ready |
| `settlement_batches` | Optional `settlementPolicyId` | Policy-driven batches |
| `app_pricing_configs` | Documented as API cache only | Rules tables are source of truth |
| `ModuleType` / `StoreType` | +EVENT, +PARCEL | Unified commerce |
| `PaymentMethod` | MOBILE_MONEY/CARD/… | Method ≠ provider |

---

## 4. Relationship diagram explanation

```
Merchant ──< Store ──< Product ──? CylinderType
    │                      │
    │                      └── DeliveryPricingRule (gas bands)
    ├── MerchantContract
    └── Event ──< TicketType ──? Product
                 └── Booking ──? Order ── Payment ──< PaymentProviderTransaction
                                      │
                                      ├── DeliveryPricingRule (snapshot FK)
                                      ├── CylinderExchange
                                      └── JournalEntry ──< JournalLine ──> Account ⊂ ChartOfAccounts

Rider Wallet <── WalletTransaction (debit/credit)
     └── Settlement ← SettlementPolicy / SettlementBatch
```

**Markets / liquor / gas / food** share `Merchant` → `Store(storeType)` → catalog → `Order`.  
**Parcel / intercounty** use `Ride` + `ParcelPricingProfile` (and/or delivery rules).  
**Integrations never hang off Order** — only via `Payment` → `PaymentProviderTransaction`.

---

## 5. Migration plan

1. Review `prisma/schema.prisma` + regenerated `20260726120000_*` + `20260726120100_*`.  
2. Ensure PostGIS Postgres.  
3. Apply init (empty DB) — **operator only**.  
4. Apply constraints/RLS migration.  
5. Seed: `docs/database/seeds/001_chart_of_accounts.sql` (legacy) **or** prefer `002_daladrop_pricing_and_policies.sql` (supersedes CoA+roles+pricing).  
6. Run `docs/database/validation/*`.  
7. Implement pricing engine service reading rules by `(serviceType, distance, cylinderTypeId, now())`.  
8. Wire payment adapters to write `PaymentProviderTransaction` only.

Rollback: snapshot restore (greenfield). Do not hand-roll downs for financial DDL.

---

## 6. Seed data (current Daladrop pricing)

File: [`docs/database/seeds/002_daladrop_pricing_and_policies.sql`](seeds/002_daladrop_pricing_and_policies.sql)

Includes:

- Normal bands 120/100/20 · 170/140/30 · 220/180/40  
- Gas 6kg & 13kg bands per business sheet  
- Constraint 9km / 9kg / 40×40×30 → overflow PARCEL  
- SettlementPolicy: weekly Friday `cutoffDay=5`, `16:30:00`, `Africa/Nairobi`  
- CoA skeleton for cash, escrow, payables, revenue holding, delivery expense, payout clearing  
- Parcel + intercounty profile stubs  

Admin edits rows (`effectiveTo` old rule, insert new) — **never update amounts in place** for rules already referenced by orders.

---

## 7. Why each change is required

1. **Provider split** — Adding Visa/Stripe must not alter Payment DDL.  
2. **Rule tables** — Pricing/settlement/radius are business policy, not deployables.  
3. **Snapshots on Order/Ride** — Historical invoices remain correct after admin changes bands.  
4. **Ledger + wallet debit/credit** — Rider pay is an accounting event, not `balance +=`.  
5. **SettlementPolicy** — Friday 4:30 is today’s policy, not a permanent law.  
6. **MerchantContract** — Liquor deals differ per merchant.  
7. **CylinderExchange** — Operational compliance for gas swaps.  
8. **Events via Merchant/Order** — One settlement and payment stack.  
9. **Periods / docs / tax** — Path to Balance Sheet, P&L, trial balance, tax reports.  
10. **FX triad** — Future multi-currency without redesign.

---

## 8. Existing decisions that still create technical debt (watch list)

| Decision | Risk | Mitigation |
| --- | --- | --- |
| Parallel `EventBooking.payments` and `Order.payments` | Dual payment attachment during transition | Prefer booking→order→payment; deprecate direct booking payments |
| `AppPricingConfig` JSON retained | Drift from rule tables | Generate snapshot from rules; mark inactive if mismatch |
| `ParcelPricingProfile` JSON rules | Less typed than delivery bands | Promote hot fields to columns when stable |
| Polymorphic `Wallet.ownerId` + typed FKs | Possible inconsistency | App invariant: `ownerId` matches typed FK; SQL CHECK later |
| UUID v4 PKs at 100M finance rows | Index fragmentation | Plan UUID v7 / time-partition later |
| Whole-KES seed vs Money VO default 2dp | Off-by-100 bugs | Document scale in config (`kesMinorDigits`) |
| MenuItem separate from Product | Dual catalog | Long-term: food menu as Product subtype or shared catalog SKU |
| RLS + Nest service role | Misconfigured GUC = empty results | BYPASSRLS service role + explicit user impersonation |

---

## Validation note

`prisma validate` ✅ after amend. Init migration regenerated (~2706 lines). No live DB writes performed.
