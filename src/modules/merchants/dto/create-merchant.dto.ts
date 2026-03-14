import {
  IsString,
  IsOptional,
  IsEmail,
  IsPhoneNumber,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { MERCHANT_CONSTANTS } from '../constants/merchant.constants';

export class CreateMerchantDto {
  @IsString()
  @MinLength(3)
  @MaxLength(MERCHANT_CONSTANTS.MAX_BUSINESS_NAME_LENGTH)
  business_name: string;

  @IsEmail({}, { message: 'Invalid business email' })
  @IsOptional()
  business_email?: string;

  @IsPhoneNumber('KE', { message: 'Invalid Kenyan phone number' })
  @IsOptional()
  business_phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  logo_url?: string;

  @IsString()
  @MinLength(MERCHANT_CONSTANTS.MIN_PAYBILL_LENGTH)
  @MaxLength(MERCHANT_CONSTANTS.MAX_PAYBILL_LENGTH)
  @Matches(/^\d+$/, { message: 'Paybill must contain only digits' })
  paybill_number: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  account_number: string;

  @IsString()
  @IsOptional()
  metadata?: string; // JSON string to be parsed
}
