export class MerchantCreatedEvent {
  constructor(
    public readonly merchantId: number,
    public readonly userId: number,
    public readonly businessName: string,
    public readonly timestamp: Date,
  ) {}
}

export class MerchantPaymentLinkGeneratedEvent {
  constructor(
    public readonly merchantId: number,
    public readonly userId: number,
    public readonly encryptedToken: string,
    public readonly publicUrl: string,
    public readonly timestamp: Date,
  ) {}
}

export class MerchantCardGeneratedEvent {
  constructor(
    public readonly merchantId: number,
    public readonly pdfUrl: string,
    public readonly qrUrl: string,
    public readonly timestamp: Date,
  ) {}
}
