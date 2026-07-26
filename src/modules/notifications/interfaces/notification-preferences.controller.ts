import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { UpdateNotificationPreferencesDto } from '../dto/notifications.dto';
import { NotificationPreferencesService } from '../use-cases/notification-preferences.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'customer/me/notification-preferences', version: '1' })
export class NotificationPreferencesController {
  public constructor(
    private readonly preferences: NotificationPreferencesService,
  ) {}

  @Get()
  public get(@CurrentAuth() principal: AuthPrincipalView) {
    return this.preferences.get(principal.id);
  }

  @Put()
  public update(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: UpdateNotificationPreferencesDto,
  ) {
    return this.preferences.update(principal.id, body);
  }
}
