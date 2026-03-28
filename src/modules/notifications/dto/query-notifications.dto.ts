import { Expose } from 'class-transformer';

export class QueryNotificationDto {
  @Expose()
  id: number;

  @Expose()
  userId: number;

  @Expose()
  channel: string; // e.g., 'SMS' | 'EMAIL'

  @Expose()
  recipient: string; // phone number or email

  @Expose()
  subject?: string; // optional, only for EMAIL

  @Expose()
  message: string;

  @Expose()
  priority: 'LOW' | 'NORMAL' | 'HIGH';

  @Expose()
  status: 'SENT' | 'DELIVERED' | 'FAILED';

  @Expose()
  createdAt: string;

  @Expose()
  deliveredAt: string;
}