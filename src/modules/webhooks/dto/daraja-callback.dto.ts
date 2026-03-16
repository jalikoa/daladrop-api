import {
  IsString,
  IsNotEmpty,
  IsObject,
  ValidateNested,
  IsOptional,
  IsArray,
  IsNumber,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class MetadataItem {
  @IsString()
  @IsNotEmpty()
  Name: string;

  @IsOptional()
  Value?: string | number;
}

export class CallbackMetadata {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetadataItem)
  @IsOptional()
  Item?: MetadataItem[];
}

export class StkCallbackData {
  @IsString()
  @IsNotEmpty()
  MerchantRequestID: string;

  @IsString()
  @IsNotEmpty()
  CheckoutRequestID: string;

  // Accept number or string, transform to string
  @IsOptional()
  @Transform(({ value }) => value?.toString())
  @IsString()
  ResultCode?: string;

  @IsString()
  @IsNotEmpty()
  ResultDesc: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CallbackMetadata)
  CallbackMetadata?: CallbackMetadata;
}

export class StkCallbackBody {
  @IsObject()
  @ValidateNested()
  @Type(() => StkCallbackData)
  stkCallback: StkCallbackData;
}

export class DarajaCallbackDto {
  @IsObject()
  @ValidateNested()
  @Type(() => StkCallbackBody)
  Body: StkCallbackBody;
}