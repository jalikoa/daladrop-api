import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import {
  AdminListQueryDto,
  CreateStoreDto,
  ReplaceOpeningHoursDto,
  UpdateStoreDto,
} from '../dto/merchants.dto';
import { AdminStoresService } from '../use-cases/admin-stores.service';

@ApiTags('Admin Stores')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/stores', version: '1' })
export class AdminStoresController {
  public constructor(private readonly stores: AdminStoresService) {}

  @Get()
  @RequirePermission('read', 'merchants')
  public list(
    @Query() query: AdminListQueryDto,
    @Query('merchantId') merchantId?: string,
  ) {
    return this.stores.list({
      q: query.q,
      storeType: query.storeType,
      merchantId,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get(':id')
  @RequirePermission('read', 'merchants')
  public get(@Param('id', ParseUUIDPipe) id: string) {
    return this.stores.get(id);
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('manage', 'merchants')
  public create(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: CreateStoreDto,
  ) {
    return this.stores.create(body, principal.id);
  }

  @Put(':id')
  @HttpCode(200)
  @RequirePermission('manage', 'merchants')
  public update(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStoreDto,
  ) {
    return this.stores.update(id, body, principal.id);
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('manage', 'merchants')
  public softDelete(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.stores.softDelete(id, principal.id);
  }

  @Put(':id/hours')
  @HttpCode(200)
  @RequirePermission('manage', 'merchants')
  public replaceHours(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReplaceOpeningHoursDto,
  ) {
    return this.stores.replaceOpeningHours(id, body.hours);
  }
}
