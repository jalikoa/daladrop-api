import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MerchantCardData } from '../value-objects/pdf-document.vo';

export class GeneratePdfDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsNumber()
  @IsOptional()
  width?: number;

  @IsNumber()
  @IsOptional()
  height?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MerchantCardDataDto)
  merchantData?: MerchantCardDataDto;
}

export class MerchantCardDataDto {
  @IsNumber()
  merchantId: number;

  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsString()
  @IsOptional()
  businessEmail?: string;

  @IsString()
  @IsOptional()
  businessPhone?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsNotEmpty()
  paybillNumber: string;

  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @IsString()
  @IsNotEmpty()
  qrCodeDataUrl: string;

  @IsString()
  @IsNotEmpty()
  paymentUrl: string;
}
