export class PdfGeneratedEvent {
  constructor(
    public readonly merchantId: number,
    public readonly pdfUrl: string,
    public readonly filePath: string,
    public readonly fileSize: number,
    public readonly timestamp: Date,
  ) {}
}

export class MerchantCardGeneratedEvent {
  constructor(
    public readonly merchantId: number,
    public readonly userId: number,
    public readonly pdfUrl: string,
    public readonly qrUrl: string,
    public readonly timestamp: Date,
  ) {}
}
