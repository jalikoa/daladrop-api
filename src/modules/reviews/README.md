# reviews

**Bounded context:** ratings and written feedback.

## Owns
`reviews`

## Depends on
`identity`; targets store/product/menu/rider/event/order/ride by id

## Publishes (later)
ReviewSubmitted — consumers update denormalized `ratingAvg` / `reviewCount` on stores/riders/events

## Must not
Own the aggregate counters as source of truth without events.
