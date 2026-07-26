# accounting

**Bounded context:** double-entry books and financial statements.

## Phase 2 implemented
- CoA constants (`DALADROP_KES` codes 1000–6000)
- `JournalDraft` domain + payment posting rules (`PaymentCompleted` → Dr 1000 / purpose credit, allocation hints)
- Posting engine (idempotent on `JournalEntry.paymentId`), period ensure/close, draft/post/reverse journals
- Account balance upserts on post; void via reversing POSTED entry
- Admin API under `v1/admin/accounting/*` with `accounting.read` / `accounting.manage`
- Reports: trial balance, GL, balance sheet, P&L, account statement + csv/xlsx/pdf export via `DocumentService`
- Listener: `@OnEvent('payments.PaymentCompleted')` → `PostingEngineService`

## Phase 5 implemented
- `resolveRefundPostingLines` (mirror of collection: Dr purpose default / Cr 1000, proportional
  allocation hints) and `resolveSettlementPayoutLines` (Dr beneficiary payable / Cr Payout Clearing 6000)
- `PostingEngineService.postPaymentRefunded` / `.postSettlementPayout` — both post via
  `JournalService.postDraftLinesInTx` with `externalRef` (`refund:{id}` / `settlement:{id}`) and
  **no** `paymentId`, since `JournalEntry.paymentId` is unique per payment-collected journal
- Listener: `@OnEvent('payments.PaymentRefunded')` → `PaymentRefundAccountingListener` (resolves the
  refund id from the event payload, or the latest SUCCEEDED/un-journaled refund for the payment)

## Phase 6 implemented
- New report types on `FinancialReportsService` (+ `GET /v1/admin/accounting/reports/*` and
  `/export`, `accounting.read`):
  - `accounts-payable` — rolls up CoA `2000`/`2100`/`2200` + a wallet liability snapshot
    (`balanceAmount` + `holdAmount`) per `WalletOwnerType` (MERCHANT/RIDER/ORGANIZER)
  - `accounts-receivable` — **not** trade AR (platform has none): a cash & escrow position
    report over CoA `1000`/`1200`/`1300`, with `1100` (customer wallets) surfaced as a labeled
    contra note, never summed into the total
  - `commission` — aggregates `Order.platformCommissionAmount` / `merchantCommissionAmount` /
    `serviceFeeAmount` / `deliveryFeeAmount` by `moduleType`, filtered to the period's
    `createdAt` range (orders have no `paidAt`) and excluding `PENDING_PAYMENT` / `CANCELLED` /
    `FAILED` orders
  - `settlement` — lists `SettlementBatch` rows created/processed in the period with a
    status breakdown
  - `p-and-l` — alias of `income-statement` (same data, same route pattern)
- `GET /v1/admin/accounting/finance-overview` (`accounting.read`): wallet totals by owner
  type, open escrow count/amount, pending settlement batch count/amount, latest open
  period's net income

## Owns
`charts_of_accounts`, `accounts`, `fiscal_periods`, `accounting_periods`, `account_balances`,  
`journal_entries`, `journal_lines` (+ later financial documents / tax / reconciliation)

## Depends on
`payments` (optional `paymentId` on journal), seed **002** CoA rows, FX fields on money lines

## Publishes
`accounting.JournalPosted`, `accounting.PeriodClosed`

## Must not
Talk to payment gateways or mutate order status.

## Notes
Journals are append-only when POSTED; reverse via new entry.  
KES whole shillings (scale 0). Debit always equals credit.
