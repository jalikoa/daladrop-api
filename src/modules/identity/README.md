# identity

**Bounded context:** who a person is and how they authenticate.

## Owns
`users`, `user_credentials`, `password_history`, `social_identities`, `sessions`, `devices`, `login_attempts`, `otp_challenges`

## Depends on
— (root context)

## Publishes (later)
UserRegistered, SessionCreated, SessionRevoked, PasswordChanged, DeviceTrusted

## Must not
Own roles/permissions, orders, wallets, or payment gateway state.

## Notes
Sessions store hashed refresh tokens only. OTP codes are hashed. Soft-delete via `deletedAt`.
