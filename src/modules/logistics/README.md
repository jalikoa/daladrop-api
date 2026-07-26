# logistics

**Bounded context:** configurable delivery constraints and pricing policy (source of truth).

## Owns
`delivery_constraints`, `delivery_pricing_rules`, `parcel_pricing_profiles`, `settlement_policies`

## Depends on
`catalog` (optional cylinder/product refs on rules)

## HTTP
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/v1/checkout/quote` | Bearer | Distance + DB rule fees (no hardcoding) |
| GET | `/v1/admin/delivery-pricing-rules` | `logistics.read` | List bands |
| POST/PATCH | `/v1/admin/delivery-pricing-rules` | `logistics.manage` | CRUD |
| GET/POST/PATCH | `/v1/admin/delivery-constraints` | logistics.* | Max radius etc. |

## Exports
`DeliveryQuoteService` — `quoteNormalDelivery`, `quoteGasDelivery`, `quoteCheckout`, `resolveServiceFee`

## Must not
Create orders/rides or hold money — consumers snapshot quoted amounts.

## Notes
Never hardcode 9 km / 120-170-220 / Friday 16:30 in application code — read these tables (seed `002_daladrop_pricing_and_policies.sql`).  
`AppPricingConfig` in `discovery` is a published cache, not the source of truth.  
Default checkout service fee: `CHECKOUT_SERVICE_FEE_KES` (default 14) or active `AppPricingConfig.payload.serviceFee`.
