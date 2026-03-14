import {
  Controller,
  Post,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('sms')
  async sendSms(@Body('phone') phone: string, @Body('message') message: string): Promise<void> {
    return this.notificationsService.sendSms(phone, message);
  }

  @Post('email')
  async sendEmail(
    @Body('email') email: string,
    @Body('subject') subject: string,
    @Body('body') body: string,
  ): Promise<void> {
    return this.notificationsService.sendEmail(email, subject, body);
  }

  @Post('push')
  async sendPush(
    @Body('token') token: string,
    @Body('title') title: string,
    @Body('body') body: string,
  ): Promise<void> {
    return this.notificationsService.sendPush(token, title, body);
  }
}
