import { Expose, Transform } from 'class-transformer';

export class NfcTagResponseDto {
  @Expose()
  id: number;

  @Expose()
  merchant_id: number;

  @Expose()
  tag_uid: string | null;

  @Expose()
  encrypted_payload: string;

  @Expose()
  is_active: boolean;

  @Expose()
  description: string | null;

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  created_at: Date;
}

export class DecodedTokenResponseDto {
  @Expose()
  success: boolean;

  @Expose()
  data: {
    merchant_id: number;
    merchant_name: string;
    merchant_logo?: string | null;
    session_uuid?: string;
    expires_at?: string;
  };
}
