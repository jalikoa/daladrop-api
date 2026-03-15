# API Testing with cURL

Below are ready-to-run cURL examples for every mapped route in the app. Replace placeholders (`<...>`) with real values (JWT, IDs, tokens, file names). Protected routes require an Authorization header: `Authorization: Bearer <JWT>`. Base URL: `http://localhost:3000`.

## Public

- GET /pay?token=...
```bash
curl -sS "http://localhost:3000/pay?token=<ENCRYPTED_TOKEN>"
```

## Users (`/users`)

- POST /users (admin)
```bash
curl -sS -X POST http://localhost:3000/users \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret","first_name":"Alice","last_name":"Doe"}'
```
- GET /users (admin)
```bash
curl -sS "http://localhost:3000/users?page=1&limit=10" -H "Authorization: Bearer <JWT>"
```
- GET /users/:id
```bash
curl -sS "http://localhost:3000/users/123" -H "Authorization: Bearer <JWT>"
```
- GET /users/uuid/:uuid
```bash
curl -sS "http://localhost:3000/users/uuid/<USER_UUID>" -H "Authorization: Bearer <JWT>"
```
- PATCH /users/:id
```bash
curl -sS -X PATCH "http://localhost:3000/users/123" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Updated"}'
```
- DELETE /users/:id
```bash
curl -sS -X DELETE "http://localhost:3000/users/123" -H "Authorization: Bearer <JWT>"
```

## Auth (`/auth`)

- POST /auth/login
```bash
curl -sS -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret"}'
```
- POST /auth/refresh
```bash
curl -sS -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<REFRESH_TOKEN>"}'
```

## Notifications (`/notifications`) (admin)

- POST /notifications/sms
```bash
curl -sS -X POST http://localhost:3000/notifications/sms \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+254700000000","message":"Test SMS"}'
```
- POST /notifications/email
```bash
curl -sS -X POST http://localhost:3000/notifications/email \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","subject":"Hi","body":"Hello"}'
```
- POST /notifications/push
```bash
curl -sS -X POST http://localhost:3000/notifications/push \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"token":"<DEVICE_TOKEN>","title":"Title","body":"Body"}'
```

## Merchants (`/merchants`)

- POST /merchants?user_id=
```bash
curl -sS -X POST "http://localhost:3000/merchants?user_id=42" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"businessName":"Demo","paybill_number":"123456","metadata":"{}"}'
```
- GET /merchants
```bash
curl -sS "http://localhost:3000/merchants?page=1&limit=10" -H "Authorization: Bearer <JWT>"
```
- GET /merchants/:id
```bash
curl -sS "http://localhost:3000/merchants/10" -H "Authorization: Bearer <JWT>"
```
- GET /merchants/me
```bash
curl -sS "http://localhost:3000/merchants/me" -H "Authorization: Bearer <JWT>"
```
- GET /merchants/:id/payment-link?qr=
```bash
curl -sS "http://localhost:3000/merchants/10/payment-link?qr=true" -H "Authorization: Bearer <JWT>"
```
- PATCH /merchants/:id
```bash
curl -sS -X PATCH "http://localhost:3000/merchants/10" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"businessName":"New Name"}'
```
- GET /merchants/:id/cards
```bash
curl -sS "http://localhost:3000/merchants/10/cards" -H "Authorization: Bearer <JWT>"
```

## NFC (`/nfc`)

- POST /nfc?merchant_id=
```bash
curl -sS -X POST "http://localhost:3000/nfc?merchant_id=10" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"tag_uid":"ABC123","description":"Card"}'
```
- GET /nfc?merchant_id=&page=&limit=
```bash
curl -sS "http://localhost:3000/nfc?merchant_id=10&page=1&limit=10" -H "Authorization: Bearer <JWT>"
```
- GET /nfc/:id
```bash
curl -sS "http://localhost:3000/nfc/5" -H "Authorization: Bearer <JWT>"
```
- GET /nfc/decode?token=
```bash
curl -sS "http://localhost:3000/nfc/decode?encryptedToken=<ENCRYPTED_TOKEN>"
```

## Payments (`/payments`)

- POST /payments/stk
```bash
curl -sS -X POST http://localhost:3000/payments/stk \
  -H "Content-Type: application/json" \
  -d '{"merchant_id":10,"phone":"+254700000000","amount":100,"session_uuid":"<UUID>","description":"Test"}'
```
- GET /payments (admin/merchant)
```bash
curl -sS "http://localhost:3000/payments?page=1&limit=10" -H "Authorization: Bearer <JWT>"
```
- GET /payments/:id
```bash
curl -sS "http://localhost:3000/payments/123" -H "Authorization: Bearer <JWT>"
```
- GET /payments/session/:uuid
```bash
curl -sS "http://localhost:3000/payments/session/<SESSION_UUID>"
```
- GET /payments/merchant/:merchantId
```bash
curl -sS "http://localhost:3000/payments/merchant/10?page=1&limit=10" -H "Authorization: Bearer <JWT>"
```
- GET /payments/merchant/:merchantId/statistics
```bash
curl -sS "http://localhost:3000/payments/merchant/10/statistics?from=2026-02-01&to=2026-03-01" -H "Authorization: Bearer <JWT>"
```

## Webhooks (`/webhooks`)

- POST /webhooks/daraja/stk
```bash
curl -sS -X POST http://localhost:3000/webhooks/daraja/stk \
  -H "Content-Type: application/json" \
  -d '{"MerchantRequestID":"123","CheckoutRequestID":"456","ResultCode":0,"ResultDesc":"Success","CallbackMetadata":{"Item":[{"Name":"Amount","Value":100},{"Name":"MpesaReceiptNumber","Value":"ABC123"}]}}'
```
- POST /webhooks/africastalking/sms
```bash
curl -sS -X POST http://localhost:3000/webhooks/africastalking/sms \
  -H "Content-Type: application/json" \
  -d '{"id":"123","text":"Hello","to":"+254700000000","from":"+254711000000","date":"2026-03-15T10:00:00Z","linkId":"link123"}'
```
- GET /webhooks/logs
```bash
curl -sS "http://localhost:3000/webhooks/logs?page=1&limit=10"
```
- GET /webhooks/logs/:id
```bash
curl -sS "http://localhost:3000/webhooks/logs/123"
```

## QR (`/qr`)

- POST /qr/generate
```bash
curl -sS -X POST http://localhost:3000/qr/generate \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"data":"https://example.com","size":300,"errorCorrection":"H"}'
```
- GET /qr/merchant/:merchantId
```bash
curl -sS "http://localhost:3000/qr/merchant/10?size=300" -H "Authorization: Bearer <JWT>"
```
- GET /qr/download/:merchantId
```bash
curl -sS "http://localhost:3000/qr/download/10" -H "Authorization: Bearer <JWT>" -o qr.png
```

## PDF (`/pdf`)

- GET /pdf/merchant/:merchantId/card
```bash
curl -sS "http://localhost:3000/pdf/merchant/10/card" -H "Authorization: Bearer <JWT>" -o card.pdf
```
- POST /pdf/merchant/:merchantId/card/generate
```bash
curl -sS -X POST "http://localhost:3000/pdf/merchant/10/card/generate?async=true" -H "Authorization: Bearer <JWT>"
```
- GET /pdf/download/:fileName
```bash
curl -sS "http://localhost:3000/pdf/download/merchant_10_card.pdf" -H "Authorization: Bearer <JWT>" -o downloaded.pdf
```

## Audit (`/audit`) (admin)

- GET /audit/logs
```bash
curl -sS "http://localhost:3000/audit/logs?page=1&limit=20" -H "Authorization: Bearer <JWT>"
```

## Health (`/health`)

- GET /health
```bash
curl -sS "http://localhost:3000/health"
```
- GET /health/ready
```bash
curl -sS "http://localhost:3000/health/ready"
```
- GET /health/metrics (admin)
```bash
curl -sS "http://localhost:3000/health/metrics" -H "Authorization: Bearer <JWT>"
```
- GET /health/version
```bash
curl -sS "http://localhost:3000/health/version"
```