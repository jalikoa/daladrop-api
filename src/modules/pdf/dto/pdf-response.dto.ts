import { Expose, Transform } from 'class-transformer';

export class PdfResponseDto {
  @Expose()
  success: boolean;

  @Expose()
  data: {
    pdf_url: string;
    file_name: string;
    file_size: number;
    merchant_id: number;
    pages: number;
  };

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  generated_at: Date;
}

export class PdfDownloadResponseDto {
  @Expose()
  content_type: string;

  @Expose()
  file_name: string;

  @Expose()
  content_length: number;
}
