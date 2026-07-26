import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../guards/auth-token.guard';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { CurrentAuth } from '../decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../domain/auth.contracts';
import { AdminStatusDto, AdminListUsersQueryDto } from '../dto/profile.dto';
import { AdminUsersService } from '../use-cases/admin-users.service';

@ApiTags('Admin Users')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/users', version: '1' })
export class AdminUsersController {
  public constructor(private readonly admin: AdminUsersService) {}

  @Get()
  @RequirePermission('read', 'users')
  public list(
    @Query() query: AdminListUsersQueryDto,
  ) {
    return this.admin.list({
      q: query.q,
      status: query.status,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    });
  }

  @Get(':userId')
  @RequirePermission('read', 'users')
  public get(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.admin.get(userId);
  }

  @Post(':userId/freeze')
  @HttpCode(200)
  @RequirePermission('manage', 'users')
  public freeze(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: AdminStatusDto,
  ) {
    return this.admin.freeze(principal.id, userId, body.reason);
  }

  @Post(':userId/restrict')
  @HttpCode(200)
  @RequirePermission('manage', 'users')
  public restrict(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: AdminStatusDto,
  ) {
    return this.admin.restrict(principal.id, userId, body.reason);
  }

  @Post(':userId/restore')
  @HttpCode(200)
  @RequirePermission('manage', 'users')
  public restore(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: AdminStatusDto,
  ) {
    return this.admin.restore(principal.id, userId, body.reason);
  }

  @Post(':userId/revoke-sessions')
  @HttpCode(200)
  @RequirePermission('manage', 'users')
  public revokeSessions(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.admin.revokeSessions(userId);
  }
}
