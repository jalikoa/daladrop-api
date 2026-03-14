import { PaymentSession } from '../entities/payment-session.entity';
import { PaymentCallback } from '../entities/payment-callback.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { InitiateStkDto } from '../dto/initiate-stk.dto';

export interface IPaymentRepository {
  findById(id: number): Promise<PaymentSession | null>;
  findByUuid(uuid: string): Promise<PaymentSession | null>;
  findByCheckoutId(checkoutId: string): Promise<PaymentSession | null>;
  findByReceipt(receipt: string): Promise<PaymentSession | null>;
  findByMerchant(merchantId: number, page: number, limit: number, status?: PaymentStatus): Promise<{ data: PaymentSession[]; total: number }>;
  createSession(data: CreateSessionData): Promise<PaymentSession>;
  updateStatus(id: number, status: PaymentStatus, metadata?: Partial<PaymentSession>): Promise<PaymentSession>;
  markCompleted(id: number, receipt: string): Promise<PaymentSession>;
  markFailed(id: number, reason: string, code?: string): Promise<PaymentSession>;

  saveCallback(data: SaveCallbackData): Promise<PaymentCallback>;
  hasProcessedCallback(receipt: string): Promise<boolean>;

  countByMerchant(merchantId: number, status?: PaymentStatus): Promise<number>;
  sumByMerchant(merchantId: number, startDate: Date, endDate: Date): Promise<number>;
}

export interface CreateSessionData {
  merchantId: number;
  customerPhone?: string;
  amount: number;
  currency?: string;
  paymentType?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  sessionUuid?: string;
}

export interface SaveCallbackData {
  checkoutRequestId: string;
  mpesaReceiptNumber?: string;
  resultCode?: number;
  resultDesc?: string;
  payload: Record<string, unknown>;
  ipAddress?: string;
}
