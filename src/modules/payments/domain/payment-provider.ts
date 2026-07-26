import { createHash, timingSafeEqual } from 'node:crypto';

export type PaymentReferenceType =
  | 'INTERNAL'
  | 'PROVIDER'
  | 'CHECKOUT'
  | 'RECEIPT'
  | 'IDEMPOTENCY';

export interface PaymentReference {
  readonly type: PaymentReferenceType;
  readonly value: string;
}

export interface ProviderCommand {
  readonly paymentId: string;
  readonly amount: bigint;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly reference: string;
  readonly customerId?: string;
  readonly payerIdentifier?: string;
  readonly callbackUrl?: string;
  readonly description?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ProviderActionCommand {
  readonly paymentId: string;
  readonly providerReference: string;
  readonly idempotencyKey: string;
  readonly amount?: bigint;
  readonly currency?: string;
  readonly reason?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type ProviderResultStatus =
  | 'PENDING'
  | 'REQUIRES_ACTION'
  | 'AUTHORISED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REVERSED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export interface ProviderResult {
  readonly status: ProviderResultStatus;
  readonly providerReference?: string;
  readonly checkoutReference?: string;
  readonly message?: string;
  readonly failureCode?: string;
  readonly raw?: unknown;
}

export interface NormalizedWebhookResult extends ProviderResult {
  readonly eventId: string;
  readonly paymentReference?: string;
  readonly occurredAt: Date;
  readonly amount?: bigint;
  readonly currency?: string;
}

export interface WebhookInput {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: unknown;
  readonly rawBody?: Buffer;
  readonly receivedAt: Date;
}

export interface ProviderHealth {
  readonly available: boolean;
  readonly providerCode: string;
  readonly reason?: string;
}

export interface PaymentProvider {
  readonly code: string;
  initiatePayment(command: ProviderCommand): Promise<ProviderResult>;
  queryPayment(command: ProviderActionCommand): Promise<ProviderResult>;
  cancelPayment(command: ProviderActionCommand): Promise<ProviderResult>;
  reversePayment(command: ProviderActionCommand): Promise<ProviderResult>;
  refundPayment(command: ProviderActionCommand): Promise<ProviderResult>;
  validateCallback(input: WebhookInput): Promise<boolean>;
  handleWebhook(input: WebhookInput): Promise<NormalizedWebhookResult>;
  generateReference(paymentId: string): string;
  verifySignature(payload: Buffer, signature: string, timestamp?: string): Promise<boolean>;
  healthCheck(): Promise<ProviderHealth>;
  validateConfiguration(): readonly string[];
}

export class UnsupportedProviderCapabilityError extends Error {
  public readonly code = 'UNSUPPORTED_PROVIDER_CAPABILITY';
  public constructor(provider: string, capability: string) {
    super(`${provider} does not support ${capability}`);
    this.name = 'UnsupportedProviderCapabilityError';
  }
}

export class ProviderUnavailableError extends Error {
  public readonly code = 'PROVIDER_UNAVAILABLE';
  public constructor(provider: string, reason: string) {
    super(`${provider} is unavailable: ${reason}`);
    this.name = 'ProviderUnavailableError';
  }
}

export class InvalidProviderCallbackError extends Error {
  public readonly code = 'INVALID_PROVIDER_CALLBACK';
  public constructor(message = 'Provider callback verification failed') {
    super(message);
    this.name = 'InvalidProviderCallbackError';
  }
}

export function deterministicReference(prefix: string, paymentId: string): string {
  return `${prefix}-${createHash('sha256').update(paymentId).digest('hex').slice(0, 24).toUpperCase()}`;
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
