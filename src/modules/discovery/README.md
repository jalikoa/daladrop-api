# discovery

**Bounded context:** home/feed CMS and published pricing snapshots for the client.

## Owns
`discovery_sections`, `discovery_section_items`, `app_pricing_configs` (cache only)

## Depends on
Reads from `merchants`, `catalog`, `events`, `logistics` (to build feed / snapshot)

## HTTP
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/v1/config/pricing` | Public | Customer-safe bands (no riderPay / platformCommission) |

Builds payload from `DeliveryPricingRule` + constraints, then upserts active `AppPricingConfig` cache (`version=customer-v1`).

## Must not
Be the source of truth for delivery fees — that is `logistics`.
