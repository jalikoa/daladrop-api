# events

**Bounded context:** event publishing and ticketing (specialized product vertical).

## Owns
`event_organizers`, `event_categories`, `events`, `event_ticket_types`, `event_bookings`, `event_tickets`

## Depends on
`merchants` (required merchant id), `identity`, optional `catalog.product`, checkout via `orders`

## Publishes (later)
EventPublished, BookingCreated, TicketIssued, TicketRedeemed

## Must not
Implement a separate payment or settlement stack — reuse `payments` / `wallets` / `accounting`.

## Notes
Tickets remain first-class for QR / inventory; commercial settlement flows through merchant + order + payment.
