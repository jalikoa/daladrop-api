import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IWebhookHandler, WebhookProcessResult } from '../interfaces/webhook-handler.interface';
import { WebhookLog } from '../entities/webhook-log.entity';
import { DarajaSignatureValidator } from '../validators/daraja-signature.validator';
import { WEBHOOK_CONSTANTS } from '../constants/webhook.constants';
import { StkCallbackData } from '../dto/daraja-callback.dto';

@Injectable()
export class DarajaWebhookHandler implements IWebhookHandler {
  private readonly logger = new Logger(DarajaWebhookHandler.name);

  constructor(
    private readonly signatureValidator: DarajaSignatureValidator,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async validate(payload: unknown, headers: Record<string, string>): Promise<boolean> {
    const signature = headers['x-signature'] || headers['X-Signature'];
    if (signature) {
      const isValid = await this.signatureValidator.verify(JSON.stringify(payload), signature as string);
      if (!isValid) {
        this.logger.warn('Daraja signature validation failed');
        return false;
      }
    }

    if (!payload || typeof payload !== 'object') return false;

    const body = (payload as any).Body?.stkCallback;
    if (!body?.CheckoutRequestID || !body?.ResultCode) return false;

    return true;
  }

  async process(payload: unknown, log: WebhookLog): Promise<WebhookProcessResult> {
    try {
      const callbackData = (payload as any).Body.stkCallback as StkCallbackData;
      const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callbackData;

      this.logger.log(`Processing Daraja callback: ${CheckoutRequestID} - ${ResultCode}`);

      const receiptNumber = this.extractMetadataValue(CallbackMetadata, 'MpesaReceiptNumber');
      const amount = this.extractMetadataValue(CallbackMetadata, 'Amount');
      const phoneNumber = this.extractMetadataValue(CallbackMetadata, 'PhoneNumber');

      const eventType = ResultCode === WEBHOOK_CONSTANTS.DARAJA.RESULT_CODE_SUCCESS
        ? WEBHOOK_CONSTANTS.EVENTS.DARAJA_CALLBACK
        : 'payment.failed';

      this.eventEmitter.emit(eventType, {
        checkoutRequestId: CheckoutRequestID,
        merchantRequestId: callbackData.MerchantRequestID,
        resultCode: ResultCode,
        resultDesc: ResultDesc,
        receiptNumber,
        amount: amount ? parseFloat(amount) : undefined,
        phoneNumber,
        timestamp: new Date(),
        webhookLogId: log.id,
      });

      return {
        success: true,
        eventsEmitted: [eventType],
        data: {
          checkoutRequestId: CheckoutRequestID,
          receiptNumber,
          amount,
          phoneNumber,
        },
      };
    } catch (error) {
      this.logger.error('Failed to process Daraja callback', error);
      return {
        success: false,
        eventsEmitted: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getEventType(payload: unknown): string {
    const resultCode = (payload as any)?.Body?.stkCallback?.ResultCode;
    if (resultCode === WEBHOOK_CONSTANTS.DARAJA.RESULT_CODE_SUCCESS) return 'payment.completed';
    return 'payment.failed';
  }

  getIdempotencyKey(payload: unknown): string | null {
    const receiptNumber = this.extractMetadataValue((payload as any)?.Body?.stkCallback?.CallbackMetadata, 'MpesaReceiptNumber');
    return receiptNumber || (payload as any)?.Body?.stkCallback?.CheckoutRequestID || null;
  }

  private extractMetadataValue(metadata: { Item: Array<{ Name: string; Value: string }> } | undefined, name: string): string | undefined {
    if (!metadata?.Item) return undefined;
    const item = metadata.Item.find((i) => i.Name === name);
    return item?.Value;
  }
}
