export class QrGeneratedEvent {
  constructor(
    public readonly merchantId: number,
    public readonly qrCodeDataUrl: string,
    public readonly paymentUrl: string,
    public readonly filePath?: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class QrDownloadRequestedEvent {
  constructor(
    public readonly merchantId: number,
    public readonly userId: number,
    public readonly timestamp: Date = new Date(),
  ) {}
}
