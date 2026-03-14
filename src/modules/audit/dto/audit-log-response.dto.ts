import { Expose, Transform } from 'class-transformer';

export class AuditLogResponseDto {
  @Expose()
  id: number;

  @Expose()
  user_id: number | null;

  @Expose()
  action: string;

  @Expose()
  ip_address: string | null;

  @Expose()
  endpoint: string | null;

  @Expose()
  payload: Record<string, unknown> | null;

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  created_at: Date;
}
