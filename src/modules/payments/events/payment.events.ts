export class PaymentSessionCreatedEvent {
  constructor(
    public readonly sessionUuid: string,
    public readonly merchantId: number,
    public readonly amount: number,
    public readonly timestamp: Date,
  ) {}
}

export class PaymentInitiatedEvent {
  constructor(
    public readonly paymentId: number,
    public readonly sessionUuid: string,
    public readonly merchantId: number,
    public readonly checkoutRequestId: string,
    public readonly amount: number,
    public readonly phone: string,
    public readonly timestamp: Date,
  ) {}
}

export class PaymentCompletedEvent {
  constructor(
    public readonly paymentId: number,
    public readonly sessionUuid: string,
    public readonly merchantId: number,
    public readonly customerPhone: string,
    public readonly amount: number,
    public readonly receipt: string,
    public readonly darajaResponse: Record<string, unknown>,
    public readonly timestamp: Date,
  ) {}
}

export class PaymentFailedEvent {
  constructor(
    public readonly paymentId: number,
    public readonly sessionUuid: string,
    public readonly merchantId: number,
    public readonly reason: string,
    public readonly timestamp: Date,
    public readonly code?: string,
  ) {}
}
