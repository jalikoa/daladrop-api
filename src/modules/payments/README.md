# payments

**Bounded context:** collecting customer money (provider-agnostic).

## Owns
`payments`, `payment_provider_transactions`, `payment_allocations`, `refunds`, `chargebacks`

## Depends on
`orders` / `transport` / `events` (payable references by id)

## Publishes
`payments.PaymentCreated`, `PaymentAuthorised`, `PaymentCompleted`, `PaymentFailed`, `PaymentCancelled`,
`PaymentRefunded` (payload includes `refundId` + `refundAmount` on top of the usual payment fields)

## Must not
Embed Daraja/Stripe fields on the core Payment model — those live only on `payment_provider_transactions`.  
Must not own chart of accounts or wallet balances.

## Notes
Adapters: M-Pesa Daraja, future Visa/Mastercard/Airtel/Stripe/Flutterwave/Pesapal/bank.  
After SUCCESS → notify `accounting` / `wallets` via domain/integration events.

## Phase 5: refunds
- `PaymentsService.refund()` validates the requested amount against `payment.amount − Σ(PENDING/PROCESSING/SUCCEEDED refunds)`,
  creates a `Refund` row (idempotent via `providerRef = idem:{idempotencyKey}`), calls the provider, then
  marks the refund `SUCCEEDED`/`FAILED` and stamps `completedAt` + the real provider reference.
- `accounting.PaymentRefundAccountingListener` posts the unwind journal (`resolveRefundPostingLines`,
  `externalRef: refund:{id}` — never `paymentId`, which is unique per payment-collected journal) once a
  refund is `SUCCEEDED`.
- `wallets.WalletMirroringService` reacts to that `JournalPosted` to unhold escrow (or debit the customer
  wallet for `WALLET_TOP_UP`), idempotent on wallet txn reference `refund:{refundId}`.
- Chargebacks remain schema-only (out of scope for Phase 5).
