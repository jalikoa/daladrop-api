import {
  IsString,
  IsNotEmpty,
  IsObject,
  ValidateNested,
  IsOptional,
  IsArray,
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
  @ValidateNested()
  @Type(() => CallbackMetadata)
  CallbackMetadata?: CallbackMetadata;
}

export class CallbackMetadata {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetadataItem)
  Item: MetadataItem[];
}

export class MetadataItem {
  @IsString()
  @IsNotEmpty()
  Name: string;

  @IsString()
  @IsNotEmpty()
  Value: string;
}
