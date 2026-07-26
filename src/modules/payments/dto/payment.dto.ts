import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @ApiProperty({ example: '2500', description: 'Whole currency units; KES has scale 0' })
  @IsNumberString({ no_symbols: true })
  public amount!: string;

  @ApiProperty({ example: 'KES' })
  @IsString()
  @Length(3, 3)
  public currency!: string;

  @ApiProperty({ example: 'ORDER' })
  @IsIn(['ORDER', 'RIDE', 'EVENT_BOOKING', 'WALLET_TOP_UP', 'SETTLEMENT', 'REFUND', 'OTHER'])
  public purpose!: string;

  @ApiProperty({ example: 'MANUAL', enum: ['MANUAL', 'MPESA_DARAJA', 'KOPOKOPO'] })
  @IsString()
  public providerCode!: string;

  @ApiPropertyOptional({ example: '254712345678' })
  @IsOptional()
  @IsString()
  public payerIdentifier?: string;

  @ApiPropertyOptional({ example: 'Order DD-10001' })
  @IsOptional()
  @IsString()
  public description?: string;
}

export class PaymentMutationDto {
  @ApiProperty({ example: 'mutation-018fc16d' })
  @IsString()
  @IsNotEmpty()
  public idempotencyKey!: string;

  @ApiPropertyOptional({ example: 'Customer requested cancellation' })
  @IsOptional()
  @IsString()
  public reason?: string;
}

export class RefundPaymentDto extends PaymentMutationDto {
  @ApiProperty({ example: '500' })
  @IsNumberString({ no_symbols: true })
  public amount!: string;
}

export class ListPaymentsDto {
  @ApiPropertyOptional({ example: 'SUCCESS' })
  @IsOptional()
  @IsString()
  public status?: string;

  @ApiPropertyOptional({ example: 'MANUAL' })
  @IsOptional()
  @IsString()
  public providerCode?: string;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  public limit = 50;

  @ApiPropertyOptional({ default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  public offset = 0;
}

export class PaymentIdDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  public id!: string;
}
