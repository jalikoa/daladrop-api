import { PaymentLifecycleStatus } from '@prisma/client';
import type { PaymentLifecycle } from '../domain/payment';

/** Domain lifecycle → persisted enterprise sub-state. */
export function toPersistedLifecycle(
  lifecycle: PaymentLifecycle,
): PaymentLifecycleStatus {
  switch (lifecycle) {
    case 'CREATED':
      return PaymentLifecycleStatus.DRAFT;
    case 'INITIATION_PENDING':
    case 'AWAITING_CUSTOMER':
      return PaymentLifecycleStatus.PENDING;
    case 'AUTHORISED':
      return PaymentLifecycleStatus.AUTHORISED;
    case 'CAPTURED':
      return PaymentLifecycleStatus.SUCCEEDED;
    case 'FAILED':
      return PaymentLifecycleStatus.FAILED;
    case 'EXPIRED':
      return PaymentLifecycleStatus.EXPIRED;
    case 'CANCELLED':
      return PaymentLifecycleStatus.CANCELLED;
    case 'REVERSAL_PENDING':
    case 'REFUND_PENDING':
      return PaymentLifecycleStatus.REFUND_PENDING;
    case 'REVERSED':
      return PaymentLifecycleStatus.REVERSED;
    case 'PARTIALLY_REFUNDED':
      return PaymentLifecycleStatus.PARTIALLY_REFUNDED;
    case 'REFUNDED':
      return PaymentLifecycleStatus.REFUNDED;
    default:
      return PaymentLifecycleStatus.PENDING;
  }
}

/** Persisted enterprise sub-state → domain lifecycle (best-effort restore). */
export function fromPersistedLifecycle(
  status: PaymentLifecycleStatus,
  publicStatusFallback?: PaymentLifecycle,
): PaymentLifecycle {
  switch (status) {
    case PaymentLifecycleStatus.DRAFT:
      return 'CREATED';
    case PaymentLifecycleStatus.PENDING:
      return publicStatusFallback ?? 'AWAITING_CUSTOMER';
    case PaymentLifecycleStatus.AUTHORISED:
      return 'AUTHORISED';
    case PaymentLifecycleStatus.PROCESSING:
      return 'AWAITING_CUSTOMER';
    case PaymentLifecycleStatus.SUCCEEDED:
    case PaymentLifecycleStatus.SETTLED:
    case PaymentLifecycleStatus.SETTLEMENT_PENDING:
      return 'CAPTURED';
    case PaymentLifecycleStatus.FAILED:
      return 'FAILED';
    case PaymentLifecycleStatus.EXPIRED:
      return 'EXPIRED';
    case PaymentLifecycleStatus.CANCELLED:
      return 'CANCELLED';
    case PaymentLifecycleStatus.REFUND_PENDING:
      return 'REFUND_PENDING';
    case PaymentLifecycleStatus.REFUNDED:
      return 'REFUNDED';
    case PaymentLifecycleStatus.PARTIALLY_REFUNDED:
      return 'PARTIALLY_REFUNDED';
    case PaymentLifecycleStatus.REVERSED:
      return 'REVERSED';
    case PaymentLifecycleStatus.CHARGEBACK:
    case PaymentLifecycleStatus.DISPUTED:
      return 'CAPTURED';
    default:
      return publicStatusFallback ?? 'CREATED';
  }
}
