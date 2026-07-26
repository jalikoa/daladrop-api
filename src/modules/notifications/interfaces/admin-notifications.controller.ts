import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { BroadcastNotificationDto } from '../dto/notifications.dto';
import { AdminNotificationsService } from '../use-cases/admin-notifications.service';

@ApiTags('Admin Notifications')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/notifications', version: '1' })
export class AdminNotificationsController {
  public constructor(private readonly admin: AdminNotificationsService) {}

  @Post('broadcast')
  @RequirePermission('manage', 'notifications')
  public broadcast(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: BroadcastNotificationDto,
  ) {
    return this.admin.broadcast(principal.id, body);
  }
}
