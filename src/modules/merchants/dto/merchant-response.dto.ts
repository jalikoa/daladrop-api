import { Expose, Transform } from 'class-transformer';
import { MerchantStatus, MerchantVerificationStatus } from '../enums/merchant-status.enum';

export class MerchantResponseDto {
  @Expose()
  id: number;

  @Expose()
  user_id: number;

  @Expose()
  business_name: string;

  @Expose()
  business_email: string | null;

  @Expose()
  business_phone: string | null;

  @Expose()
  logo_url: string | null;

  @Expose()
  paybill_number: string;

  @Expose()
  account_number: string;

  @Expose()
  status: MerchantStatus;

  @Expose()
  verification_status: MerchantVerificationStatus;

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  created_at: Date;

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  updated_at: Date;

  @Expose()
  is_active: boolean;
}
