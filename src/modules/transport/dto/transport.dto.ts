import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RideServiceType, RideStatus } from '@prisma/client';

export class RideQuoteDto {
  @ApiProperty({ enum: RideServiceType })
  @IsEnum(RideServiceType)
  serviceType!: RideServiceType;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  pickupLat!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  pickupLng!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  dropoffLat!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  dropoffLng!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  vehicleType?: string;

  @ApiPropertyOptional({ enum: ['Small', 'Medium', 'Large'] })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  weightCategory?: string;

  @ApiPropertyOptional({ description: 'Inter-county route id when serviceType=INTER_COUNTY' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  routeId?: string;
}

export class CreateRideDto {
  @ApiPropertyOptional({ description: 'Ignored server-side — the authenticated principal owns the ride' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ enum: RideServiceType })
  @IsEnum(RideServiceType)
  serviceType!: RideServiceType;

  @ApiPropertyOptional({ default: 'BIKE' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  vehicleType?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  pickupLat!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  pickupLng!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  dropoffLat!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  dropoffLng!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pickupAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  dropoffAddress?: string;

  @ApiPropertyOptional({ description: 'Display hint only — server always recomputes the fare' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fare?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  itemDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  receiverPhone?: string;

  @ApiPropertyOptional({ enum: ['Small', 'Medium', 'Large'] })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  weightCategory?: string;

  @ApiPropertyOptional({ description: 'Courier partner display name, resolved to CourierPartner.id' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessPartner?: string;

  @ApiPropertyOptional({
    description:
      'Alias for businessPartner: either a CourierPartner.id (UUID) or its display name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  partnerId?: string;

  @ApiPropertyOptional({ description: 'Free-form parcel size hint, stored as-is on Ride.parcelSize' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  parcelSize?: string;

  @ApiPropertyOptional({ description: 'Inter-county route id when serviceType=INTER_COUNTY' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  routeId?: string;

  @ApiPropertyOptional({ description: 'Required for create-and-pay; omitted for request (boda)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mpesaPhone?: string;

  @ApiPropertyOptional({
    description: 'Persisted pricing quote id from POST /ride/quote or checkout — server validates and consumes it',
  })
  @IsOptional()
  @IsUUID()
  quoteId?: string;
}

export class PayRideDto {
  @ApiProperty()
  @IsString()
  @MaxLength(20)
  mpesaPhone!: string;

  @ApiPropertyOptional({ description: 'Ignored server-side — the authenticated principal owns the ride' })
  @IsOptional()
  @IsString()
  customerId?: string;
}

export class CancelRideDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Frontend debt: client sometimes sends { role } instead of {}' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  role?: string;
}

export class RateRideDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  score?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Alias for score' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional({ description: 'Ignored server-side — the authenticated principal is the reviewer' })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class NearbyRidersQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  lng!: number;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  radius?: number;
}

export class RiderRidesQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/** Accepts either canonical `RideStatus` values or UI aliases (ACCEPTED, ARRIVED, ...). */
export class UpdateRideStatusDto {
  @ApiProperty({ description: 'RideStatus value or UI alias (ACCEPTED, ARRIVED, PICKED_UP, IN_TRANSIT, ...)' })
  @IsString()
  @MaxLength(32)
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** Proof-of-delivery photo URL (parcel/courier complete). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  podPhotoUrl?: string;

  /** Proof-of-delivery signature URL. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  podSignatureUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  podNotes?: string;
}

/** Legacy `POST /ride/update-status` — ride id travels in the body. */
export class UpdateRideStatusByBodyDto extends UpdateRideStatusDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  rideId!: string;
}

export class UpsertCourierPartnerDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  brandUrl?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertInterCountyRouteDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  label!: string;

  @ApiProperty({ description: 'Quoted fare in whole KES' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quotedFare!: number;

  @ApiPropertyOptional({ default: 'KES' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  defaultPickup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  defaultDropoff?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignRiderDto {
  @ApiProperty()
  @IsUUID()
  riderId!: string;
}

export class AdminListRidesQueryDto {
  @ApiPropertyOptional({ enum: RideStatus })
  @IsOptional()
  @IsEnum(RideStatus)
  status?: RideStatus;

  @ApiPropertyOptional({ enum: RideServiceType })
  @IsOptional()
  @IsEnum(RideServiceType)
  serviceType?: RideServiceType;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
