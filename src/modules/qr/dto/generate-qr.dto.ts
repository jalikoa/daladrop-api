import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';
import { QR_CONSTANTS } from '../constants/qr.constants';

export class GenerateQrDto {
  @IsString()
  @IsNotEmpty()
  data: string; // The URL or data to encode

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(1000)
  size?: number = QR_CONSTANTS.DEFAULT_SIZE;

  @IsOptional()
  @IsString()
  errorCorrection?: 'L' | 'M' | 'Q' | 'H' = 'M';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  margin?: number = QR_CONSTANTS.DEFAULT_MARGIN;

  @IsOptional()
  @IsString()
  merchant_id?: string; // For tracking
}
