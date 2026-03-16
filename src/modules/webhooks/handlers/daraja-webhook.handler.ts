import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IWebhookHandler, WebhookProcessResult } from '../interfaces/webhook-handler.interface';
import { WebhookLog } from '../entities/webhook-log.entity';
import { DarajaSignatureValidator } from '../validators/daraja-signature.validator';
import { HandleCallbackUseCase } from '../../payments/use-cases/handle-callback.usecase';
import { WEBHOOK_CONSTANTS } from '../constants/webhook.constants';
import { StkCallbackData } from '../dto/daraja-callback.dto';

@Injectable()
export class DarajaWebhookHandler implements IWebhookHandler {
  private readonly logger = new Logger(DarajaWebhookHandler.name);

  constructor(
    private readonly signatureValidator: DarajaSignatureValidator,
    private readonly eventEmitter: EventEmitter2,
    // HandleCallbackUseCase is injectable here because WebhooksModule imports PaymentsModule
    // which already exports HandleCallbackUseCase
    private readonly handleCallbackUseCase: HandleCallbackUseCase,
  ) {}

  async validate(payload: unknown, headers: Record<string, string>): Promise<boolean> {
    const signature = headers['x-signature'] || headers['X-Signature'];
    if (signature) {
      const isValid = await this.signatureValidator.verify(
        JSON.stringify(payload),
        signature as string,
      );
      if (!isValid) {
        this.logger.warn('Daraja signature validation failed');
        return false;
      }
    }

    if (!payload || typeof payload !== 'object') return false;
    const body = (payload as any).Body?.stkCallback;
    if (!body?.CheckoutRequestID || body?.ResultCode === undefined) return false;
    return true;
  }

  async process(payload: unknown, log: WebhookLog): Promise<WebhookProcessResult> {
    try {
      const callbackData = (payload as any).Body.stkCallback as StkCallbackData;
      const { CheckoutRequestID, ResultCode } = callbackData;

      this.logger.log(`Processing Daraja callback: ${CheckoutRequestID} - ${ResultCode}`);

      // Delegate entirely to HandleCallbackUseCase — it:
      //   1. Finds the payment_sessions row by checkout_request_id
      //   2. Saves the payment_callbacks row
      //   3. Calls markCompleted() or markFailed() on the session
      //   4. Emits payment.completed / payment.failed with the full
      //      PaymentCompletedEvent / PaymentFailedEvent shape that
      //      PaymentListener expects (paymentId, sessionUuid, merchantId, etc.)
      const result = await this.handleCallbackUseCase.execute(callbackData, log.ip_address);

      const eventType = ResultCode === WEBHOOK_CONSTANTS.DARAJA.RESULT_CODE_SUCCESS
        ? 'payment.completed'
        : 'payment.failed';

      return {
        success: result.success,
        eventsEmitted: [eventType],
        data: { checkoutRequestId: CheckoutRequestID, message: result.message },
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
    return resultCode === WEBHOOK_CONSTANTS.DARAJA.RESULT_CODE_SUCCESS
      ? 'payment.completed'
      : 'payment.failed';
  }

  getIdempotencyKey(payload: unknown): string | null {
    const cb = (payload as any)?.Body?.stkCallback;
    const receipt = cb?.CallbackMetadata?.Item?.find(
      (i: any) => i.Name === 'MpesaReceiptNumber',
    )?.Value;
    return receipt || cb?.CheckoutRequestID || null;
  }
}