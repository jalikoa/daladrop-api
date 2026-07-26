# authorization

**Bounded context:** what an authenticated principal may do (RBAC).

## Owns
`roles`, `permissions`, `role_permissions`, `user_roles`

## Depends on
`identity` (user id only)

## Publishes (later)
RoleAssigned, RoleRevoked, PermissionGranted

## Must not
Own login/session lifecycle or business resources (stores, orders).

## Notes
Maps cleanly to platform `RbacEngine` — this module is the durable store; platform may cache.
