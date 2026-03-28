import { Expose, Type } from 'class-transformer';
import { QueryNotificationDto } from './query-notifications.dto';

export class NotificationsResponseDto {
  @Expose()
  data: QueryNotificationDto[];

  @Expose()
  total: number;

  @Expose()
  page: number;

  @Expose()
  limit: number;

  @Expose()
  totalPages: number;

  static fromQuery(data: QueryNotificationDto[], total: number, page: number, limit: number): NotificationsResponseDto {
    const dto = new NotificationsResponseDto();
    dto.data = data;
    dto.total = total;
    dto.page = page;
    dto.limit = limit;
    dto.totalPages = Math.ceil(total / limit);
    return dto;
  }
}
