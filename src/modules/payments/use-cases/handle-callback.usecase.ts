import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IPaymentRepository } from '../interfaces/payment-repository.interface';
import { PAYMENT_CONSTANTS } from '../constants/payment.constants';
import { StkCallbackData } from '../dto/daraja-callback.dto';

@Injectable()
export class HandleCallbackUseCase {
  private readonly logger = new Logger(HandleCallbackUseCase.name);

  constructor(
    private readonly paymentRepo: IPaymentRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(callbackData: StkCallbackData, ipAddress?: string) {
    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callbackData as any;
    this.logger.log(`Processing Daraja callback: ${CheckoutRequestID}`);

    const session = await this.paymentRepo.findByCheckoutId(CheckoutRequestID);
    if (!session) {
      this.logger.warn(`Payment session not found for ${CheckoutRequestID}`);
      return { success: false, message: 'Session not found' };
    }

    const mpesaReceipt = this.extractReceipt(CallbackMetadata);
    if (mpesaReceipt && (await this.paymentRepo.hasProcessedCallback(mpesaReceipt))) {
      this.logger.warn(`Duplicate callback for receipt ${mpesaReceipt}`);
      return { success: true, message: 'Already processed' };
    }

    await this.paymentRepo.saveCallback({
      checkoutRequestId: CheckoutRequestID,
      mpesaReceiptNumber: mpesaReceipt,
      resultCode: parseInt(ResultCode),
      resultDesc: ResultDesc,
      payload: callbackData as unknown as Record<string, unknown>,
      ipAddress,
    });

    if (ResultCode === '0') {
      await this.paymentRepo.markCompleted(session.id, mpesaReceipt || 'UNKNOWN');
      this.eventEmitter.emit(PAYMENT_CONSTANTS.EVENTS.COMPLETED, {
        paymentId: session.id,
        sessionUuid: session.session_uuid,
        merchantId: session.merchant_id,
        customerPhone: session.customer_phone,
        amount: session.amount,
        receipt: mpesaReceipt,
        darajaResponse: callbackData,
        timestamp: new Date(),
      });
      this.logger.log(`Payment completed: ${session.session_uuid} - Receipt: ${mpesaReceipt}`);
    } else {
      await this.paymentRepo.markFailed(session.id, ResultDesc, ResultCode);
      this.eventEmitter.emit(PAYMENT_CONSTANTS.EVENTS.FAILED, {
        paymentId: session.id,
        sessionUuid: session.session_uuid,
        merchantId: session.merchant_id,
        reason: ResultDesc,
        code: ResultCode,
        timestamp: new Date(),
      });
      this.logger.warn(`Payment failed: ${session.session_uuid} - ${ResultDesc}`);
    }

    return { success: true, message: 'Callback processed' };
  }

  private extractReceipt(metadata?: { Item: Array<{ Name: string; Value: unknown }> }): string | undefined {
    if (!metadata?.Item) return undefined;
    const receiptItem = metadata.Item.find(item => item.Name === 'MpesaReceiptNumber');
    return receiptItem?.Value as string | undefined;
  }
}
