import { Expose, Transform } from 'class-transformer';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentType } from '../enums/payment-type.enum';

export class PaymentResponseDto {
  @Expose()
  id: number;

  @Expose()
  session_uuid: string;

  @Expose()
  merchant_id: number;

  @Expose()
  merchant_name?: string;

  @Expose()
  customer_phone: string;

  @Expose()
  amount: number;

  @Expose()
  currency: string;

  @Expose()
  status: PaymentStatus;

  @Expose()
  payment_type: PaymentType;

  @Expose()
  checkout_request_id?: string;

  @Expose()
  mpesa_receipt?: string;

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  created_at: Date;

  @Expose()
  @Transform(({ value }) => (value ? value.toISOString() : null))
  completed_at: Date | null;

  @Expose()
  description?: string;
}

export class StkPushResponseDto {
  @Expose()
  success: boolean;

  @Expose()
  payload: {
    checkout_request_id: string;
    response_code: string;
    response_description: string;
    merchant_request_id: string;
    session_uuid: string;
  };

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  timestamp: Date;
}
