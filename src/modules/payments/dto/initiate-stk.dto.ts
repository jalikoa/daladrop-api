import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { PAYMENT_CONSTANTS } from '../constants/payment.constants';
import { Transform } from 'class-transformer';

export class InitiateStkDto {
  @IsInt()
  @Min(PAYMENT_CONSTANTS.STK.MIN_AMOUNT)
  @Max(PAYMENT_CONSTANTS.STK.MAX_AMOUNT)
  amount: number;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  merchant_hash: string;

  @IsUUID()
  @IsOptional()
  session_uuid?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Transform(({ value }) => value?.toString())
  @IsOptional()
  metadata?: string; // JSON string
}
