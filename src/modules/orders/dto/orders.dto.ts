import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ModuleOrderStatus } from '@prisma/client';

/**
 * Resolves the effective delivery coordinate for checkout payloads that
 * accept both the legacy `lat`/`lng` fields and the documented
 * `deliveryLat`/`deliveryLng` aliases. `delivery*` wins when both are present.
 */
export function resolveDeliveryCoordinates(body: {
  lat?: number;
  lng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
}): { lat?: number; lng?: number } {
  return {
    lat: body.deliveryLat ?? body.lat,
    lng: body.deliveryLng ?? body.lng,
  };
}

export class CheckoutLineModifierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  optionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class CheckoutLineDto {
  @ApiPropertyOptional({
    description: 'Legacy alias for menuItemId / productId (create-and-pay clients)',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  menuItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ description: 'Alias for notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customizationNotes?: string;

  @ApiPropertyOptional({
    description: 'Client unit price hint — ignored for payable totals',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional({ type: [CheckoutLineModifierDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutLineModifierDto)
  modifiers?: CheckoutLineModifierDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  modifierOptionIds?: string[];
}

export class VendorOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  marketId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  liquorStoreId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gasStoreId?: string;

  @ApiPropertyOptional({
    description:
      'Persisted PricingQuote id from POST /v1/checkout/quote. Required for money authority.',
  })
  @IsOptional()
  @IsUUID()
  quoteId?: string;

  @ApiProperty({ type: [CheckoutLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutLineDto)
  items!: CheckoutLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /**
   * Client-computed display totals — accepted for UI compatibility but never
   * used as money authority (server quote / line pricing wins).
   */
  @ApiPropertyOptional({ description: 'Client display hint — ignored for payable totals' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  subtotal?: number;

  @ApiPropertyOptional({ description: 'Client display hint — ignored for payable totals' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deliveryFee?: number;
}

export class MultiCheckoutDto {
  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty({ type: [VendorOrderDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VendorOrderDto)
  orders!: VendorOrderDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  deliveryAddress?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  mpesaPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  /**
   * Client-computed totals — accepted for UI compatibility but ignored;
   * server pricing / quote is the money authority.
   */
  @ApiPropertyOptional({ description: 'Client display hint — ignored for payable totals' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  serviceFee?: number;

  @ApiPropertyOptional({ description: 'Client display hint — ignored for payable totals' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deliveryFee?: number;

  @ApiPropertyOptional({ description: 'Client display hint — ignored for payable totals' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  subtotal?: number;
}

export class PayOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  mpesaPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ['CANCELLED', ...Object.values(ModuleOrderStatus)] })
  @IsEnum(ModuleOrderStatus)
  status!: ModuleOrderStatus;

  @ApiPropertyOptional({ enum: ['CUSTOMER', 'ADMIN', 'SYSTEM', 'MERCHANT'] })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  actor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RateOrderDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  score?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Alias for score (restaurants)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  restaurantScore?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Alias for score (markets)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  marketScore?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Alias for score (stores)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  storeScore?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 5,
    description: 'Rider score; when present also creates a RIDER review if the order has an assigned rider',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  riderScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class AdminOrderStatusDto {
  @ApiProperty({ enum: ModuleOrderStatus })
  @IsEnum(ModuleOrderStatus)
  status!: ModuleOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminOrdersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  moduleType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(ModuleOrderStatus)
  status?: ModuleOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class FoodCreateAndPayDto {
  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiPropertyOptional({ type: [VendorOrderDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorOrderDto)
  orders?: VendorOrderDto[];

  @ApiPropertyOptional({
    description: 'Legacy single-vendor restaurant id alias',
  })
  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @ApiPropertyOptional({ type: [CheckoutLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutLineDto)
  items?: CheckoutLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  deliveryAddress?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  mpesaPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}
