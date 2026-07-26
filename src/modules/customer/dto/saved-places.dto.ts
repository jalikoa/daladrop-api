import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SavedPlaceItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  address: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  icon?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

export class PutSavedPlacesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SavedPlaceItemDto)
  places: SavedPlaceItemDto[];
}
