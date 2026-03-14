import {
  IsString,
  IsNotEmpty,
  IsObject,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DarajaCallbackDto {
  @IsObject()
  @ValidateNested()
  @Type(() => StkCallbackBody)
  Body: StkCallbackBody;
}

export class StkCallbackBody {
  @IsString()
  @IsNotEmpty()
  stkCallback: StkCallbackData;
}

export class StkCallbackData {
  @IsString()
  @IsNotEmpty()
  MerchantRequestID: string;

  @IsString()
  @IsNotEmpty()
  CheckoutRequestID: string;

  @IsString()
  @IsNotEmpty()
  ResultCode: string;

  @IsString()
  @IsNotEmpty()
  ResultDesc: string;

  @IsObject()
  @IsOptional()
  CallbackMetadata?: {
    Item: Array<{ Name: string; Value: unknown }>;
  };
}
