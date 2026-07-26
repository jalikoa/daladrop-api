# customer

**Bounded context:** customer-facing preferences and personal places (not identity itself).

## Owns
`saved_places`, `menu_favourites`, `saved_items`

## HTTP (Uidocs `02-users` / `18-profile`)
- `GET/PUT /v1/customer/me/places` — saved places sync
- `GET /v1/customer/:userId/stats` — ride/order totals (self only)
- `GET /v1/customer/:userId/history` — stub until rides module owns it (self only, Bearer required)

## Depends on
`identity` (`AuthTokenGuard`); Prisma for places/stats

## Must not
Mutate products, stores, or events — favourites are references by id + kind.
Mutate user identity/status — that stays in `identity`.
