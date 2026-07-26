import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import {
  AdminOrderStatusDto,
  AdminOrdersQueryDto,
} from '../dto/orders.dto';
import { AdminOrdersService } from '../use-cases/admin-orders.service';

@ApiTags('Admin Orders')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/orders', version: '1' })
export class AdminOrdersController {
  public constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  @RequirePermission('read', 'orders')
  public list(@Query() query: AdminOrdersQueryDto) {
    return this.orders.list(query);
  }

  @Get(':id')
  @RequirePermission('read', 'orders')
  public get(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getById(id);
  }

  @Patch(':id/status')
  @RequirePermission('manage', 'orders')
  public status(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AdminOrderStatusDto,
  ) {
    return this.orders.updateStatus(id, principal.id, body);
  }
}
