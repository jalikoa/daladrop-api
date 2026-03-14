import { PartialType } from '@nestjs/mapped-types';
import { CreateMerchantDto } from './create-merchant.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { MerchantStatus, MerchantVerificationStatus } from '../enums/merchant-status.enum';

export class UpdateMerchantDto extends PartialType(CreateMerchantDto) {
  @IsEnum(MerchantStatus)
  @IsOptional()
  status?: MerchantStatus;

  @IsEnum(MerchantVerificationStatus)
  @IsOptional()
  verification_status?: MerchantVerificationStatus;
}
