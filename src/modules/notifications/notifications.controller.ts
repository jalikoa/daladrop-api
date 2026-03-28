import {
  Controller,
  Post,
  Body,
  UseGuards,
  UsePipes,
  Get,
  ValidationPipe,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { QueryNotificationDto, NotificationsResponseDto } from './dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@ApiTags('Notifications')
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  async getNotifications(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ): Promise<NotificationsResponseDto> {
    const result = await this.notificationsService.getNotifications(page, limit);
    const totalPages = Math.ceil(result.total / limit);
    return {
      data: result.data,
      total: result.total,
      page,
      limit,
      totalPages,
    };
  }

  @Post('sms')
  @ApiOperation({ summary: 'Send SMS notification' })
  async sendSms(@Body('phone') phone: string, @Body('message') message: string): Promise<void> {
    return this.notificationsService.sendSms(phone, message);
  }

  @Post('email')
  @ApiOperation({ summary: 'Send email notification' })
  async sendEmail(
    @Body('email') email: string,
    @Body('subject') subject: string,
    @Body('body') body: string,
  ): Promise<void> {
    return this.notificationsService.sendEmail(email, subject, body);
  }

  @Post('push')
  @ApiOperation({ summary: 'Send push notification' })
  async sendPush(
    @Body('token') token: string,
    @Body('title') title: string,
    @Body('body') body: string,
  ): Promise<void> {
    return this.notificationsService.sendPush(token, title, body);
  }
}
