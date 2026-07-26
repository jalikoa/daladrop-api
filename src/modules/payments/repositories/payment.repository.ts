import type { Payment, PaymentProps, PublicPaymentStatus } from '../domain/payment';
import type { ProviderResult } from '../domain/payment-provider';

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

export interface PaymentListQuery {
  readonly status?: PublicPaymentStatus;
  readonly providerCode?: string;
  readonly customerId?: string;
  readonly limit: number;
  readonly offset: number;
}

export interface ProviderTransactionRecord {
  readonly id: string;
  readonly paymentId: string;
  readonly providerCode: string;
  readonly providerReference?: string;
  readonly checkoutReference?: string;
  readonly payerIdentifier?: string;
  readonly request?: unknown;
  readonly result: ProviderResult;
}

export interface PaymentRepository {
  save(payment: Payment): Promise<void>;
  findById(id: string): Promise<Payment | null>;
  findByIdempotencyKey(key: string): Promise<Payment | null>;
  findByReference(reference: string): Promise<Payment | null>;
  findByProviderReference(reference: string): Promise<Payment | null>;
  list(query: PaymentListQuery): Promise<readonly Payment[]>;
  saveProviderTransaction(record: ProviderTransactionRecord): Promise<void>;
  latestProviderReference(paymentId: string): Promise<string | null>;
  latestPayerIdentifier(paymentId: string): Promise<string | null>;
  hasProcessedCallback(providerCode: string, eventId: string): Promise<boolean>;
  /** Insert RECEIVED claim (or reclaim FAILED). Returns false if already PROCESSED. */
  claimCallback(
    providerCode: string,
    eventId: string,
    paymentId: string,
    payload: unknown,
  ): Promise<boolean>;
  finalizeCallback(providerCode: string, eventId: string): Promise<void>;
  failCallback(
    providerCode: string,
    eventId: string,
    errorMessage: string,
  ): Promise<void>;
}

export function deriveLifecycle(status: PublicPaymentStatus): PaymentProps['lifecycle'] {
  const states: Record<PublicPaymentStatus, PaymentProps['lifecycle']> = {
    PENDING: 'INITIATION_PENDING',
    PROCESSING: 'AWAITING_CUSTOMER',
    SUCCESS: 'CAPTURED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    REFUNDED: 'REFUNDED',
    PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  };
  return states[status];
}
