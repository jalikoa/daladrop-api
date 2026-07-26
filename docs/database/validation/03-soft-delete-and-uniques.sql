-- Soft-delete and uniqueness sanity (read-only)

-- Soft-deleted users that still have active sessions (informational)
SELECT u.id, COUNT(s.id) AS active_sessions
FROM users u
JOIN sessions s ON s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > NOW()
WHERE u.deleted_at IS NOT NULL
GROUP BY u.id;

-- Duplicate active emails (should be empty after partial unique index)
SELECT LOWER(email) AS email_norm, COUNT(*)
FROM users
WHERE email IS NOT NULL AND deleted_at IS NULL
GROUP BY LOWER(email)
HAVING COUNT(*) > 1;

-- Orders soft-deleted but still PENDING_PAYMENT unpaid (ops cleanup candidates)
SELECT id, status, payment_status, deleted_at
FROM orders
WHERE deleted_at IS NOT NULL
  AND payment_status IN ('PENDING', 'PROCESSING');

-- customer_hidden_at used correctly (history hide ≠ financial delete)
SELECT COUNT(*) AS hidden_but_not_deleted
FROM orders
WHERE customer_hidden_at IS NOT NULL AND deleted_at IS NULL;
