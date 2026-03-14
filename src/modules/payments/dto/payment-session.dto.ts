import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreatePaymentSessionDto {
  @IsUUID()
  session_uuid: string;

  @IsString()
  @IsNotEmpty()
  merchant_id: string;

  @IsOptional()
  @IsString()
  customer_phone?: string;

  @IsOptional()
  amount?: number;
}
