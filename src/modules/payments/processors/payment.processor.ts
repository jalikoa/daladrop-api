import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PAYMENT_CONSTANTS } from '../constants/payment.constants';

export interface PaymentCompletedJob {
  paymentId: number;
  sessionUuid: string;
  merchantId: number;
  customerPhone: string;
  amount: number;
  receipt: string;
  timestamp: Date;
}

export interface PaymentFailedJob {
  paymentId: number;
  sessionUuid: string;
  merchantId: number;
  reason: string;
  code?: string;
  timestamp: Date;
}

@Processor(PAYMENT_CONSTANTS.QUEUE.NAME)
export class PaymentProcessor {
  private readonly logger = new Logger(PaymentProcessor.name);

  constructor() {}

  @Process(PAYMENT_CONSTANTS.QUEUE.PROCESSORS.COMPLETED)
  async handlePaymentCompleted(job: Job<PaymentCompletedJob>) {
    const { paymentId, merchantId, amount, receipt } = job.data;

    this.logger.log(`Processing payment.completed job for ${paymentId}`);

    try {
      // 1. Ledger recording, notifications, cache updates would happen here

      this.logger.log(`Payment ${paymentId} processed successfully`);
      return { success: true, paymentId };
    } catch (error) {
      this.logger.error(`Failed to process payment ${paymentId}`, error);
      throw error;
    }
  }

  @Process(PAYMENT_CONSTANTS.QUEUE.PROCESSORS.FAILED)
  async handlePaymentFailed(job: Job<PaymentFailedJob>) {
    const { paymentId, reason } = job.data;

    this.logger.warn(`Processing payment.failed job for ${paymentId}: ${reason}`);

    try {
      return { success: true, paymentId };
    } catch (error) {
      this.logger.error(`Failed to process failure for ${paymentId}`, error);
      throw error;
    }
  }

  @Process('payment.timeout.check')
  async handleTimeoutCheck(job: Job<{ paymentId: number; checkoutRequestId: string }>) {
    const { paymentId, checkoutRequestId } = job.data;
    this.logger.log(`Checking timeout for payment ${paymentId}`);
    return { success: true };
  }
}
