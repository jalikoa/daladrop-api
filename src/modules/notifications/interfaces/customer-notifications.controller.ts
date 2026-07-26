import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { ListNotificationsQueryDto } from '../dto/notifications.dto';
import { NotificationsService } from '../use-cases/notifications.service';

/**
 * Lives in the notifications module (rather than CustomerController) to
 * avoid a circular dependency between the customer and notifications
 * modules while still exposing the customer-facing `customer/:userId/...`
 * route family.
 */
@ApiTags('Customer Notifications')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'customer', version: '1' })
export class CustomerNotificationsController {
  public constructor(private readonly notifications: NotificationsService) {}

  @Get(':userId/notifications')
  public list(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: ListNotificationsQueryDto,
  ) {
    this.assertSelf(principal.id, userId);
    return this.notifications.list(userId, query);
  }

  @Get(':userId/notifications/:id')
  public get(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertSelf(principal.id, userId);
    return this.notifications.get(userId, id);
  }

  @Delete(':userId/notifications/:id')
  public remove(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertSelf(principal.id, userId);
    return this.notifications.softDelete(userId, id);
  }

  @Post(':userId/notifications/:id/read')
  public markRead(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertSelf(principal.id, userId);
    return this.notifications.markRead(userId, id);
  }

  @Post(':userId/notifications/read-all')
  public markAllRead(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    this.assertSelf(principal.id, userId);
    return this.notifications.markAllRead(userId);
  }

  private assertSelf(actorId: string, userId: string): void {
    if (actorId !== userId) {
      throw new ForbiddenException('Cannot access another user notifications');
    }
  }
}
