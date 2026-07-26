-- Read-only validation: orphan / dangling FK style checks
-- Run AFTER migrations on a non-prod database. Do not modify data.

-- Orders without store
SELECT o.id AS orphan_order_id
FROM orders o
LEFT JOIN stores s ON s.id = o.store_id
WHERE s.id IS NULL;

-- Payments referencing missing orders
SELECT p.id AS payment_id, p.order_id
FROM payments p
LEFT JOIN orders o ON o.id = p.order_id
WHERE p.order_id IS NOT NULL AND o.id IS NULL;

-- Payments referencing missing rides
SELECT p.id AS payment_id, p.ride_id
FROM payments p
LEFT JOIN rides r ON r.id = p.ride_id
WHERE p.ride_id IS NOT NULL AND r.id IS NULL;

-- Event tickets without booking
SELECT t.id AS ticket_id
FROM event_tickets t
LEFT JOIN event_bookings b ON b.id = t.booking_id
WHERE b.id IS NULL;

-- Wallet owner exclusivity (at most one owner FK set meaningfully)
SELECT id
FROM wallets
WHERE (
  (CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN merchant_id IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN rider_id IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN organizer_id IS NOT NULL THEN 1 ELSE 0 END)
) = 0
AND owner_type <> 'PLATFORM';
