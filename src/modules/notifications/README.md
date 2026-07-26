# notifications

**Bounded context:** in-app notifications, device push registration, and
auth OTP email/SMS jobs.

## Owns
`notifications`, `push_tokens`

## Depends on
`identity` (AuthTokenGuard); optional refs to ride/order/booking ids

## Phase 15 — implemented

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/v1/customer/:uid/notifications` | Bearer + self-only; `{ notifications, unreadCount }` |
| `GET` | `/v1/customer/:uid/notifications/:id` | |
| `DELETE` | `/v1/customer/:uid/notifications/:id` | Soft-delete |
| `POST` | `/v1/customer/:uid/notifications/:id/read` | Sets `readAt` |
| `POST` | `/v1/customer/:uid/notifications/read-all` | |
| `POST` | `/v1/push/register` | `{ userId, token, platform }` |
| `DELETE` | `/v1/push/register` | Soft-delete tokens for user |
| `POST` | `/v1/admin/notifications/broadcast` | `notifications.manage` |

Listeners create IN_APP rows from `transport.RideStatusChanged` /
order payment / event booking payment events (best-effort; never throws
into the emitter).

Auth OTP email/SMS remain via `AuthJobDispatcher` + BullMQ.

## Must not
Drive business state machines (order/ride status changes).
Socket.IO rooms are deferred — REST is source of truth per Uidocs 15.
