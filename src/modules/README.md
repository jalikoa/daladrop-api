# Domain modules map

This folder holds **business bounded contexts** for Daladrop.

Scaffold modules already present (not domain):

| Module | Role |
| --- | --- |
| `health` | Liveness / readiness |
| `logger` | Structured logging |
| `metrics` | Prometheus metrics |
| `config` | Non-secret runtime metadata |

Domain modules below are **empty shells** (folders + README only).  
Populate later using `src/core`, `src/platform`, `src/infrastructure`, `src/shared`.  
Do **not** import Prisma types into `src/core`.

---

## Bounded-context map (schema → module)

| Module | Owns (tables / aggregates) | Depends on (read / anti-corruption) | Must NOT own |
| --- | --- | --- | --- |
| `identity` | `users`, credentials, password history, social identities, sessions, devices, login attempts, OTP challenges | — | Roles, wallets, orders |
| `authorization` | `roles`, `permissions`, `role_permissions`, `user_roles` | `identity` (user id) | Auth sessions |
| `compliance` | `legal_acceptances`, `age_verifications` | `identity` | Payments |
| `customer` | `saved_places`, `menu_favourites`, `saved_items` | `identity`, `catalog`, `merchants`, `events` | Catalog writes |
| `merchants` | `merchants`, `stores`, `store_opening_hours`, `merchant_contracts` | `identity` (owner) | Products, orders |
| `catalog` | `categories`, `products`, `menu_*`, `modifier_*`, `cylinder_types` | `merchants` (store id) | Orders, pricing rules |
| `carts` | `carts`, `cart_items` | `identity`, `catalog` | Checkout/payment |
| `orders` | `orders`, `order_items`, `order_status_history`, `cylinder_exchanges` | `merchants`, `catalog`, `identity`, `logistics`, `transport` (rider assign) | Ledger postings, gateway calls |
| `logistics` | `delivery_constraints`, `delivery_pricing_rules`, `parcel_pricing_profiles`, `settlement_policies` | — (policy BC) | Order state |
| `transport` | `riders`, `rides`, `ride_status_history`, `courier_partners`, `inter_county_routes` | `identity`, `logistics` | Commerce order lines |
| `events` | `event_organizers`, `event_categories`, `events`, `event_ticket_types`, `event_bookings`, `event_tickets` | `merchants`, `catalog` (optional product), `orders` (checkout), `identity` | Payment provider details |
| `payments` | `payments`, `payment_provider_transactions`, `payment_allocations`, `refunds`, `chargebacks` | `orders`, `transport`, `events` (by id) | Journal lines, wallets |
| `accounting` | CoA, accounts, fiscal/accounting periods, balances, journal entries/lines, financial documents, tax ledger, reconciliation | `payments` (refs) | Gateway payloads |
| `wallets` | `wallets`, `wallet_transactions`, `escrow_holds`, `settlement_batches`, `settlement_items`, `settlements` | `accounting` (journal refs), `payments`, `logistics` (policy) | Pricing rules |
| `reviews` | `reviews` | `identity`, `merchants`/`catalog`/`transport`/`events`/`orders` | Ratings aggregates (updated via events) |
| `notifications` | `notifications`, `push_tokens` | `identity` | Business workflows |
| `discovery` | `discovery_sections`, `discovery_section_items`, `app_pricing_configs` (API snapshot cache) | `merchants`, `catalog`, `events`, `logistics` | Source-of-truth pricing |
| `operations` | feature flags, maintenance windows, admin notes, support tickets, audit records, API clients/keys, webhook delivery logs | all (observability / admin) | Domain invariants |

**Platform-owned (do not duplicate as domain modules):** outbox publishing, idempotency store, queue, cache, tenancy — live under `src/platform` / `src/infrastructure`. Tables `outbox_events` and `idempotency_records` are infrastructure concerns consumed by every module.

---

## Coupling rules

1. Modules talk through **application ports / domain events**, not shared Prisma models.
2. Cross-module references use **IDs only** (UUID), not ORM joins across contexts in repositories.
3. Money movements: `orders`/`transport`/`events` → emit intent → `payments` collects → `accounting` posts → `wallets` mirrors liability / settlement.
4. Pricing: only `logistics` defines rules; `orders`/`transport` **snapshot** amounts at quote time.
5. Providers (M-Pesa, Stripe, …) stay inside `payments` adapters — never leak into other modules.

---

## Suggested populate order

1. `identity` → `authorization` → `compliance`  
2. `merchants` → `catalog` → `logistics`  
3. `carts` → `orders` → `payments` → `accounting` → `wallets`  
4. `transport` → `events`  
5. `customer` → `reviews` → `notifications` → `discovery` → `operations`

---

## Folder layout (per domain module)

Aligned with `module.sh` conventions, empty for now:

```
<module>/
  README.md
  domain/            # entities, value-objects, domain events (ports later)
  use-cases/         # application services / use cases
  repositories/      # ports + prisma/ + typeorm/ adapters later
  dto/
  interfaces/        # HTTP / RPC adapters later
  mappers/
  events/            # integration event contracts
  enums/
  constants/
  validators/
  adapters/
  guards/
  listeners/
  processors/
  queues/
  __tests__/
```

Generate fuller stubs later with:

```bash
yarn module:generate <name> --with-cqrs
```

Only after agreeing the README ownership for that module.
