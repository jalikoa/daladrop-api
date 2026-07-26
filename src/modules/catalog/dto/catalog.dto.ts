import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ModuleType, ProductServiceType } from '@prisma/client';

export class FoodCategoryAdminDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  iconKey?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  imageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFoodCategoryAdminDto extends PartialType(
  FoodCategoryAdminDto,
) {}

export class MenuCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMenuCategoryDto extends PartialType(MenuCategoryDto) {}

export class MenuItemDto {
  @IsUUID()
  menuCategoryId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceAmount: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  preparationTime?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  calories?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateMenuItemDto extends PartialType(MenuItemDto) {}

export class ModifierGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minSelect?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxSelect?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateModifierGroupDto extends PartialType(ModifierGroupDto) {}

export class ModifierOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priceDelta?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateModifierOptionDto extends PartialType(ModifierOptionDto) {}

export class ModuleCategoryAdminDto extends FoodCategoryAdminDto {
  @IsEnum(ModuleType)
  moduleType: ModuleType;
}

export class UpdateModuleCategoryAdminDto extends PartialType(
  ModuleCategoryAdminDto,
) {}

export class ModuleCategoryListQueryDto {
  @IsEnum(ModuleType)
  moduleType: ModuleType;
}

export class OptionalModuleTypeQueryDto {
  @IsOptional()
  @IsEnum(ModuleType)
  moduleType?: ModuleType;
}

export class VerticalProductQueryDto {
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
  @MaxLength(120)
  brand?: string;

  @IsOptional()
  @IsString()
  minPrice?: string;

  @IsOptional()
  @IsString()
  maxPrice?: string;

  @IsOptional()
  @IsString()
  discount?: string;

  @IsOptional()
  @IsString()
  inStock?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  size?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  serviceType?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  featured?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

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
  openNow?: string;

  @IsOptional()
  @IsString()
  minRating?: string;
}

export class ProductAdminDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  cylinderTypeId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceAmount: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  originalPrice?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  ageRestricted?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  sizeLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  volumeLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  abv?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  unitLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lengthCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  widthCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  heightCm?: number;

  @IsOptional()
  @IsEnum(ProductServiceType)
  serviceType?: ProductServiceType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateProductAdminDto extends PartialType(ProductAdminDto) {}
