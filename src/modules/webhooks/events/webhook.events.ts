export class WebhookReceivedEvent {
  constructor(public readonly webhookId: number, public readonly source: string, public readonly eventType: string, public readonly ip: string, public readonly timestamp: Date) {}
}

export class WebhookProcessedEvent {
  constructor(public readonly webhookId: number, public readonly source: string, public readonly success: boolean, public readonly eventsEmitted: string[], public readonly timestamp: Date) {}
}

export class DarajaCallbackEvent {
  constructor(
    public readonly checkoutRequestId: string,
    public readonly merchantRequestId: string,
    public readonly resultCode: string,
    public readonly resultDesc: string,
    public readonly receiptNumber?: string,
    public readonly amount?: number,
    public readonly phoneNumber?: string,
    public readonly timestamp?: Date,
    public readonly webhookLogId?: number,
  ) {}
}
