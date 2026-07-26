import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LogisticsServiceType, VehicleType } from '@prisma/client';

export class CheckoutQuoteItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  menuItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Legacy alias for unit price hint' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Legacy alias for unit price hint' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cylinderTypeId?: string;
}

export class CheckoutQuoteDto {
  @ApiProperty({
    description: 'Vendor vertical',
    enum: ['food', 'market', 'liquor', 'gas', 'RESTAURANT', 'MARKET', 'LIQUOR', 'GAS'],
  })
  @IsString()
  @MaxLength(32)
  vendorType!: string;

  @ApiProperty()
  @IsUUID()
  vendorId!: string;

  @ApiProperty({ type: [CheckoutQuoteItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutQuoteItemDto)
  items!: CheckoutQuoteItemDto[];

  @ApiPropertyOptional({
    description: 'Alias for deliveryLat; deliveryLat takes precedence when both are present',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({
    description: 'Alias for deliveryLng; deliveryLng takes precedence when both are present',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ description: 'Preferred over lat when both are present' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deliveryLat?: number;

  @ApiPropertyOptional({ description: 'Preferred over lng when both are present' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deliveryLng?: number;
}

export class CreateDeliveryPricingRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ enum: LogisticsServiceType })
  @IsEnum(LogisticsServiceType)
  serviceType!: LogisticsServiceType;

  @ApiPropertyOptional({ enum: VehicleType, default: VehicleType.BIKE })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceMinKm!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceMaxKm!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cylinderTypeId?: string;

  @ApiProperty({ description: 'Whole KES shillings' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  customerCharge!: number;

  @ApiProperty({ description: 'Whole KES shillings' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  riderPay!: number;

  @ApiProperty({ description: 'Whole KES shillings' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  platformCommission!: number;

  @ApiProperty()
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateDeliveryPricingRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceMinKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceMaxKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cylinderTypeId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  customerCharge?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  riderPay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  platformCommission?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class CreateDeliveryConstraintDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: LogisticsServiceType })
  @IsEnum(LogisticsServiceType)
  serviceType!: LogisticsServiceType;

  @ApiPropertyOptional({ enum: VehicleType, default: VehicleType.BIKE })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxDistanceKm!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxWeightKg!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxLengthCm!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxWidthCm!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxHeightCm!: number;

  @ApiPropertyOptional({ enum: LogisticsServiceType })
  @IsOptional()
  @IsEnum(LogisticsServiceType)
  overflowServiceType?: LogisticsServiceType;

  @ApiProperty()
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateDeliveryConstraintDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxDistanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxWeightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxLengthCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxWidthCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxHeightCm?: number;

  @ApiPropertyOptional({ enum: LogisticsServiceType })
  @IsOptional()
  @IsEnum(LogisticsServiceType)
  overflowServiceType?: LogisticsServiceType | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
