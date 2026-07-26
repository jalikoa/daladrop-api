# operations

**Bounded context:** platform administration, support, and auditability.

## Owns
`feature_flags`, `maintenance_windows`, `admin_notes`, `support_tickets`,  
`audit_records`, `api_clients`, `api_keys`, `webhook_delivery_logs`

## Depends on
All domains (observes / annotates by table+id); does not own their invariants

## Publishes (later)
FeatureFlagChanged, MaintenanceScheduled, SupportTicketOpened

## Must not
Duplicate `outbox_events` / `idempotency_records` — those stay in `src/platform`.

## Notes
`audit_records` are immutable entity audits (before/after), not HTTP access logs.
