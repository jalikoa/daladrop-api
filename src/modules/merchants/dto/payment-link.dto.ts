import { Expose } from 'class-transformer';

export class PaymentLinkResponseDto {
  @Expose()
  merchant_id: number;

  @Expose()
  merchant_name: string;

  @Expose()
  payment_url: string;

  @Expose()
  encrypted_token: string;

  @Expose()
  qr_code_data_url: string;

  @Expose()
  expires_at: Date;

  @Expose()
  created_at: Date;
}
