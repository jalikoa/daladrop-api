# orders

**Bounded context:** commerce fulfilment for food / market / liquor / gas checkout.

## Owns
`orders`, `order_items`, `order_status_history`, `cylinder_exchanges`

## Depends on
`identity`, `merchants`/`catalog` (via Prisma), `logistics` (quotes), `payments`, `compliance` (liquor age gate)

## HTTP (version `1`)
| Method | Path | Notes |
|--------|------|-------|
| POST | `/v1/orders/{food\|markets\|liquor\|gas}/multi-checkout` | Place PENDING_PAYMENT orders |
| POST | `/v1/orders/food/create-and-pay` | Legacy thin wrapper |
| GET/POST/PATCH | `/v1/{food\|market\|liquor\|gas}-orders/:id…` | Detail, pay, cancel, rate |
| GET/DELETE | `/v1/customer/:uid/{food\|market\|liquor\|gas}-orders` | History / soft-hide |
| GET/PATCH | `/v1/admin/orders…` | `orders.read` / `orders.manage` |

## Money
All math via `src/shared/money`. Customer JSON amounts are whole KES numbers.  
Multi-vendor: `serviceFee` allocated with `Money.allocate` across orders.

## Payments
Place does **not** auto-STK (`ORDERS_STK_ON_PLACE` default false). Pay uses `PaymentsService` purpose `ORDER`.  
Listeners set PAID / paymentStatus SUCCESS|FAILED.

## Must not
Mutate wallets or post journals directly.
