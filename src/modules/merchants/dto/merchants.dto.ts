import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DayOfWeek, MerchantStatus, StoreType } from '@prisma/client';

export class RestaurantListQueryDto {
  @IsOptional()
  @IsString()
  discover?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({ description: 'Alias for category' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  categorySlug?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional({ description: 'Alias for limit' })
  @IsOptional()
  @IsString()
  pageSize?: string;

  @IsOptional()
  @IsString()
  lat?: string;

  @IsOptional()
  @IsString()
  lng?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  openNow?: string;

  @IsOptional()
  @IsString()
  minRating?: string;

  @IsOptional()
  @IsString()
  featured?: string;
}

export class MerchantListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  serviceType?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;

  @IsOptional()
  @IsString()
  lat?: string;

  @IsOptional()
  @IsString()
  lng?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  openNow?: string;

  @IsOptional()
  @IsString()
  minRating?: string;

  @IsOptional()
  @IsString()
  featured?: string;
}

export class CreateMerchantDto {
  @IsUUID()
  ownerUserId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  isOrganizer?: boolean;

  @IsOptional()
  @IsEnum(MerchantStatus)
  status?: MerchantStatus;
}

export class UpdateMerchantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  isOrganizer?: boolean;

  @IsOptional()
  @IsEnum(MerchantStatus)
  status?: MerchantStatus;
}

export class CreateStoreDto {
  @IsUUID()
  merchantId: string;

  @IsEnum(StoreType)
  storeType: StoreType;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  whatsapp?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  website?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deliveryFeeHint?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimumOrderAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deliveryTimeMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deliveryTimeMax?: number;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  ageRestricted?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deliveryFeeHint?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimumOrderAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deliveryTimeMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deliveryTimeMax?: number;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  ageRestricted?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(StoreType)
  storeType?: StoreType;
}

export class OpeningHourItemDto {
  @IsEnum(DayOfWeek)
  day: DayOfWeek;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  openTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  closeTime?: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}

export class ReplaceOpeningHoursDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningHourItemDto)
  hours: OpeningHourItemDto[];
}

export class SubmitMerchantKycDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  businessRegistrationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxPin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  directorIdNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  businessAddress?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentUrls?: string[];
}

export class ReviewMerchantKycDto {
  @IsEnum(['APPROVED', 'REJECTED'] as const)
  decision: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}

export class AdminListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  storeType?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
