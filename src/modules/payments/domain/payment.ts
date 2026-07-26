import { randomUUID } from 'node:crypto';

export type PublicPaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type PaymentLifecycle =
  | 'CREATED'
  | 'INITIATION_PENDING'
  | 'AWAITING_CUSTOMER'
  | 'AUTHORISED'
  | 'CAPTURED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REVERSAL_PENDING'
  | 'REVERSED'
  | 'REFUND_PENDING'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

const TRANSITIONS: Record<PaymentLifecycle, readonly PaymentLifecycle[]> = {
  CREATED: ['INITIATION_PENDING', 'CANCELLED', 'FAILED'],
  INITIATION_PENDING: ['AWAITING_CUSTOMER', 'AUTHORISED', 'CAPTURED', 'FAILED', 'EXPIRED', 'CANCELLED'],
  AWAITING_CUSTOMER: ['AUTHORISED', 'CAPTURED', 'FAILED', 'EXPIRED', 'CANCELLED'],
  AUTHORISED: ['CAPTURED', 'REVERSAL_PENDING', 'FAILED', 'CANCELLED'],
  CAPTURED: ['REVERSAL_PENDING', 'REFUND_PENDING'],
  FAILED: ['INITIATION_PENDING'],
  EXPIRED: ['INITIATION_PENDING'],
  CANCELLED: [],
  REVERSAL_PENDING: ['REVERSED', 'CAPTURED', 'FAILED'],
  REVERSED: [],
  REFUND_PENDING: ['PARTIALLY_REFUNDED', 'REFUNDED', 'CAPTURED', 'FAILED'],
  PARTIALLY_REFUNDED: ['REFUND_PENDING', 'REFUNDED'],
  REFUNDED: [],
};

export function toPublicPaymentStatus(state: PaymentLifecycle): PublicPaymentStatus {
  if (state === 'CAPTURED') return 'SUCCESS';
  if (state === 'FAILED' || state === 'EXPIRED') return 'FAILED';
  if (state === 'CANCELLED' || state === 'REVERSED') return 'CANCELLED';
  if (state === 'REFUNDED') return 'REFUNDED';
  if (state === 'PARTIALLY_REFUNDED') return 'PARTIALLY_REFUNDED';
  if (state === 'CREATED' || state === 'INITIATION_PENDING') return 'PENDING';
  return 'PROCESSING';
}

export type PaymentEventType =
  | 'PaymentCreated'
  | 'PaymentAuthorised'
  | 'PaymentCompleted'
  | 'PaymentFailed'
  | 'PaymentCancelled'
  | 'PaymentRefunded';

export interface PaymentEvent {
  readonly eventId: string;
  readonly eventType: PaymentEventType;
  readonly aggregateType: 'Payment';
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly version: 1;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface PaymentCreated extends PaymentEvent {
  readonly eventType: 'PaymentCreated';
}
export interface PaymentAuthorised extends PaymentEvent {
  readonly eventType: 'PaymentAuthorised';
}
export interface PaymentCompleted extends PaymentEvent {
  readonly eventType: 'PaymentCompleted';
}
export interface PaymentFailed extends PaymentEvent {
  readonly eventType: 'PaymentFailed';
}
export interface PaymentCancelled extends PaymentEvent {
  readonly eventType: 'PaymentCancelled';
}
export interface PaymentRefunded extends PaymentEvent {
  readonly eventType: 'PaymentRefunded';
}

export class PaymentTransitionError extends Error {
  public constructor(from: PaymentLifecycle, to: PaymentLifecycle) {
    super(`Payment cannot transition from ${from} to ${to}`);
    this.name = 'PaymentTransitionError';
  }
}

export interface PaymentProps {
  id: string;
  customerId?: string;
  amount: bigint;
  currency: string;
  purpose: string;
  providerCode: string;
  idempotencyKey: string;
  reference?: string;
  lifecycle: PaymentLifecycle;
  expiresAt?: Date;
  failureCode?: string;
  failureMessage?: string;
  orderId?: string;
  rideId?: string;
  eventBookingId?: string;
  metadata?: Readonly<Record<string, unknown>>;
  createdAt: Date;
  updatedAt: Date;
}

export class Payment {
  private readonly pendingEvents: PaymentEvent[] = [];

  private constructor(private readonly props: PaymentProps) {}

  public static create(
    input: Omit<PaymentProps, 'id' | 'lifecycle' | 'createdAt' | 'updatedAt'> & { id?: string },
    now = new Date(),
  ): Payment {
    if (input.amount <= 0n) throw new Error('Payment amount must be greater than zero');
    if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error('Currency must be an ISO 4217 code');
    if (!input.idempotencyKey.trim()) throw new Error('Idempotency key is required');
    const payment = new Payment({
      ...input,
      id: input.id ?? randomUUID(),
      currency: input.currency.toUpperCase(),
      lifecycle: 'CREATED',
      createdAt: now,
      updatedAt: now,
    });
    payment.record('PaymentCreated', { amount: input.amount.toString(), currency: input.currency });
    return payment;
  }

  public static restore(props: PaymentProps): Payment {
    return new Payment({ ...props });
  }

  public transition(to: PaymentLifecycle, details: Record<string, unknown> = {}, now = new Date()): void {
    if (!TRANSITIONS[this.props.lifecycle].includes(to)) {
      throw new PaymentTransitionError(this.props.lifecycle, to);
    }
    this.props.lifecycle = to;
    this.props.updatedAt = now;
    const eventByState: Partial<Record<PaymentLifecycle, PaymentEventType>> = {
      AUTHORISED: 'PaymentAuthorised',
      CAPTURED: 'PaymentCompleted',
      FAILED: 'PaymentFailed',
      EXPIRED: 'PaymentFailed',
      CANCELLED: 'PaymentCancelled',
      REVERSED: 'PaymentCancelled',
      PARTIALLY_REFUNDED: 'PaymentRefunded',
      REFUNDED: 'PaymentRefunded',
    };
    const eventType = eventByState[to];
    if (eventType) this.record(eventType, details);
  }

  public markFailure(code: string, message: string): void {
    this.props.failureCode = code;
    this.props.failureMessage = message;
    this.transition('FAILED', { code, message });
  }

  public pullEvents(): PaymentEvent[] {
    return this.pendingEvents.splice(0);
  }

  public snapshot(): Readonly<PaymentProps> {
    return { ...this.props };
  }

  public get publicStatus(): PublicPaymentStatus {
    return toPublicPaymentStatus(this.props.lifecycle);
  }

  private record(eventType: PaymentEventType, payload: Record<string, unknown>): void {
    this.pendingEvents.push({
      eventId: randomUUID(),
      eventType,
      aggregateType: 'Payment',
      aggregateId: this.props.id,
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: { paymentId: this.props.id, ...payload },
    });
  }
}
