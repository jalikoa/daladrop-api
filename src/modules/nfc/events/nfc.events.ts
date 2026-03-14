export class NfcTagCreatedEvent {
  constructor(
    public readonly tagId: number,
    public readonly merchantId: number,
    public readonly encryptedPayload: string,
    public readonly timestamp: Date,
  ) {}
}

export class NfcPaymentSessionStartedEvent {
  constructor(
    public readonly sessionUuid: string,
    public readonly merchantId: number,
    public readonly userId: number,
    public readonly timestamp: Date,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
