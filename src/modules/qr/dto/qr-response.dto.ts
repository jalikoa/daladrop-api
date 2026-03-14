import { Expose, Transform } from 'class-transformer';

export class QrCodeResponseDto {
  @Expose()
  success: boolean;

  @Expose()
  data: {
    qr_code_data_url: string; // Base64 encoded PNG
    qr_code_url: string; // CDN URL if uploaded
    original_data: string;
    size: number;
    format: string;
    created_at: Date;
  };

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  generated_at: Date;
}

export class QrCodeDownloadDto {
  @Expose()
  content_type: string;

  @Expose()
  file_name: string;

  @Expose()
  size: number;
}
