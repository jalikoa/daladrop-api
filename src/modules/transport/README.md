# transport

**Bounded context:** riders, rides, parcels, courier partners, intercounty routes.

## Owns
`riders`, `rides`, `ride_status_history`, `courier_partners`, `inter_county_routes`

## Depends on
`identity`, `logistics` (constraints / parcel profiles / pricing), `payments` (STK via
`PaymentsService.createAndInitiate`), `operations` (audit log)

## Phase 7 — implemented

Ride create-and-pay + Ride UX (quote, request, pay, retry, cancel, get, share,
rate, nearby riders, courier/inter-county catalog) plus the
`GET /api/v1/mpesa/payment-status/:rideId` alias. See
`Uidocs/api-contracts/ride-orders.md`, `Uidocs/13-transport.md`, and
`Uidocs/23-known-frontend-assumptions.md` for the client contract this
implements.

### Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/v1/ride/quote` | Server-computed fare (no ride created) |
| `POST` | `/v1/ride/create-and-pay` | Parcel/courier/inter-county/merchant — durable ride, then STK |
| `POST` | `/v1/ride/request` | Boda; no `mpesaPhone`; may return `{ success:false, noRiders:true }` |
| `GET` | `/v1/ride/:id` | Bare ride **and** `{ ride }` nested |
| `POST` | `/v1/ride/:id/pay` | `{ mpesaPhone, customerId? }` |
| `POST` | `/v1/ride/:id/retry-payment` | Reuses the payer identifier from the last failed attempt |
| `POST` | `/v1/ride/:id/cancel-unpaid` | Only while `PENDING_PAYMENT`/`SEARCHING` and unpaid |
| `POST` | `/v1/rides/:id/cancel` | Live cancel (plural alias, kept per Uidocs 23) |
| `POST` | `/v1/rides/:id/share` | `{ token, shareUrl }`; generates a share token on first call |
| `POST` | `/v1/rides/:id/rate` | Creates a `Review(targetType=RIDER)`; fails on error (no silent success) |
| `GET` | `/v1/riders/nearby?lat=&lng=&radius=` | Available riders within radius (km, default 5) |
| `GET` | `/v1/transport/courier-partners` | Active courier partners |
| `GET` | `/v1/transport/inter-county/routes` | Active inter-county routes |
| `GET` | `/api/v1/mpesa/payment-status/:rideId` | Version-neutral alias |
| `GET` | `/v1/mpesa/payment-status/:rideId` | Canonical — same handler as the alias |

All customer endpoints are `AuthTokenGuard` + self-only (ownership checked
against `Ride.customerId`); no `RequirePermission` gate. Catalog reads
(`/transport/courier-partners`, `/transport/inter-county/routes`) are public.

### Fare / status mapping

- `DeliveryQuoteService.quotePointToPoint` (in `logistics`) maps
  `RideServiceType` → `LogisticsServiceType` (`RIDE`→`RIDE`,
  `PARCEL`/`COURIER`/`MERCHANT`→`PARCEL`, `INTER_COUNTY`→`InterCountyRoute`
  lookup by id) and falls back to `NORMAL_DELIVERY` bands when no
  service-specific `DeliveryPricingRule` exists yet.
- `domain/ride-status.mapper.ts` exposes both the raw Prisma `RideStatus`
  (`status`) and a UI-friendly `uiStatus`
  (`SEARCHING`→`REQUESTED`, `ASSIGNED`→`ACCEPTED`, `ARRIVING`→`ARRIVED`,
  `IN_PROGRESS`→`IN_PROGRESS` with an `IN_TRANSIT` alias) on every ride view.
- `domain/weight-category.mapper.ts` maps the client's `Small|Medium|Large`
  (any casing) to `ParcelWeightCategory`.

### Payment flow

Mirrors `EventBookingService.pay` / `EventBookingPaymentListener`: a durable
`Ride` row always exists **before** `PaymentsService.createAndInitiate` is
called, and the endpoint never returns `success: true` when a real provider
is configured but STK wasn't initiated.
`RidePaymentListener` reacts to `payments.PaymentCompleted` /
`payments.PaymentFailed` (never on STK initiate alone) to flip
`paymentStatus` → `SUCCESS`/`FAILED` and, on success, advance
`PENDING_PAYMENT` rides to `SEARCHING` with a `RideStatusHistory` row.

### History

`CustomerModule`'s `CustomerActivityService` reads/hides `Ride` rows directly
(`GET /customer/:userId/history`, `DELETE /customer/:userId/history/:rideId`,
`DELETE /customer/:userId/history`) — ride lifecycle ownership stays with
`transport`, but history/hide is a customer-profile concern.

## Phase 13–14 lifecycle (dispatch)

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/rider/rides` | Rider's assigned / searchable rides |
| `POST` | `/v1/rider/rides/:id/accept` | SEARCHING → ASSIGNED |
| `POST` | `/v1/rider/rides/:id/status` | Rider status machine |
| `GET` | `/v1/admin/rides` | Admin list (`rides.read`) |
| `POST` | `/v1/admin/rides/:id/assign` | Manual assign (`rides.manage`) |
| `POST` | `/v1/admin/rides/:id/status` | Force transition |
| `POST` | `/v1/admin/rides/:id/cancel` | Admin cancel |

`RideDispatchService.autoAssignNearest` runs after payment → SEARCHING and after
boda `request`. Parcel create accepts `partnerId` / `parcelSize`; weight
surcharges use `ParcelPricingProfile` when seeded. Catalog seed:
`docs/database/seeds/009_transport_catalog.sql`.

## Must not
Own commerce order lines or payment provider transactions. No Socket.IO here
yet — realtime (`joinRide`, `rideAccepted`, `locationUpdate`, ...) is
deferred to a later phase; clients poll REST as backup per Uidocs.

## Notes
Parcel / intercounty / boda are `Ride.serviceType` variants — not separate
modules. Beyond normal delivery radius → parcel path using logistics
overflow rules (existing `DeliveryConstraint`, unchanged by Phase 7).
