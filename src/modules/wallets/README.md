# wallets

**Bounded context:** liability wallets, escrow holds, and settlement payouts — **not** a payment provider.

## Phase 3 implemented
- Money math via `src/shared/money` (`kes`, `kesFromBigInt` / `kesToBigInt` only at Prisma boundaries)
- Wallet ops: credit / debit / hold / release / adjust / transfer with optimistic `version` lock
- Escrow: idempotent hold on `accounting.JournalPosted`; admin release / forfeit
- Payment mirror: ORDER/RIDE/EVENT_BOOKING/OTHER → hold; `WALLET_TOP_UP` → customer **available** credit
- Platform wallet: `ownerType=PLATFORM`, `ownerId` = `PLATFORM_WALLET_OWNER_ID` or `00000000-0000-4000-8000-000000000001`
- APIs under `/v1/…` with Swagger tags separating customer vs merchant/rider finance vs admin

## Phase 5 implemented
- Refund unwind: `EscrowService.refundForPayment` fully/partially unholds an escrow, or debits the
  customer wallet for `WALLET_TOP_UP` refunds — triggered by `accounting.JournalPosted` carrying a
  `refundId` (or a journal `externalRef` starting with `refund:`); idempotent on wallet txn
  reference `refund:{refundId}`
- Settlement batch engine (`SettlementService` + `domain/settlement-policy.ts` +
  `domain/settlement-batch-assembly.ts`): cutoff-gated batch creation from a `SettlementPolicy`,
  optional approval gate, per-item wallet debit + `accounting` payout journal (`Dr` beneficiary
  payable / `Cr` Payout Clearing 6000), `MANUAL` payout provider (no real B2C yet)
- Settlement scheduling is entirely policy-driven (no hardcoded weekday/time) via
  `Intl.DateTimeFormat`-based timezone math in `settlement-policy.ts`

## Phase 6 implemented
- `FinanceDashboardService.getDashboard(ownerType, ownerId)`: wallet snapshot, last 10
  transactions, current-calendar-month (Africa/Nairobi, fixed UTC+3) earnings (credit/debit/net),
  pending settlement items + amount (batches in PENDING/PROCESSING), completed payouts + amount
  (last 90 days), and open escrow held for the owner
- `FinanceDashboardService.exportStatement(ownerType, ownerId, format)`: current-month
  transaction statement as csv/xlsx via `DocumentService` (sync `StreamableFile`, same pattern
  as accounting report exports)
- Routes: `GET /v1/merchant/wallet/dashboard`, `GET /v1/rider/wallet/dashboard`,
  `GET /v1/{merchant,rider}/wallet/statement/export?format=csv|xlsx`

## Owns
`wallets`, `wallet_transactions`, `escrow_holds`, `settlement_batches`, `settlement_items`, `settlements`

## Depends on
`accounting` (`JournalPosted` + `journalEntryId`, `JournalService`/`PostingEngineService` for settlement payouts),
`payments` (purpose / order / ride / booking links, refunds),
owner rows from identity / merchants / riders / event organizers, `AuditLogService`

## Publishes
`wallets.WalletCredited`, `wallets.WalletDebited`, `wallets.EscrowReleased`,
`wallets.SettlementBatchCreated`, `wallets.SettlementBatchCompleted`

## Routes
| Surface | Path | Notes |
| --- | --- | --- |
| Customer | `GET /v1/customer/:uid/wallet` (+ `/transactions`) | Thin read APIs; self-only; **no** checkout contract change |
| Merchant | `GET /v1/merchant/wallet` (+ `/transactions`, `/dashboard`, `/statement/export`) | Resolves `Merchant.ownerUserId` |
| Rider | `GET /v1/rider/wallet` (+ `/transactions`, `/dashboard`, `/statement/export`) | Resolves `Rider.userId` |
| Admin | `/v1/admin/wallets`, `/v1/admin/escrow` | `wallets.read` / `wallets.manage` |
| Admin | `/v1/admin/settlements/policies`, `/v1/admin/settlements/batches` | `settlements.read` / `settlements.manage` |

## Balances
- `available` = `balanceAmount` (spendable)
- `held` = `holdAmount` (`pending` alias in API views)
- `total` = `available + held` via `Money.add`

## Must not
- Raw `balanceAmount + amount` bigint arithmetic in domain/use-cases
- Invent customer wallet checkout UI that conflicts with payment envelopes
- Hardcode any settlement cutoff weekday/time/threshold — always derive from `SettlementPolicy`

## Platform wallet
Ensure via `WalletService.ensurePlatformWallet()`. Override owner UUID with env `PLATFORM_WALLET_OWNER_ID`.
