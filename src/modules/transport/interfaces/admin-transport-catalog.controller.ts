import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import {
  UpsertCourierPartnerDto,
  UpsertInterCountyRouteDto,
} from '../dto/transport.dto';
import { TransportCatalogService } from '../use-cases/transport-catalog.service';

@ApiTags('Admin Transport Catalog')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/transport', version: '1' })
export class AdminTransportCatalogController {
  public constructor(private readonly catalog: TransportCatalogService) {}

  @Get('courier-partners')
  @RequirePermission('manage', 'transport')
  public listPartners() {
    return this.catalog.adminListPartners();
  }

  @Post('courier-partners')
  @RequirePermission('manage', 'transport')
  public createPartner(@Body() body: UpsertCourierPartnerDto) {
    return this.catalog.createPartner(body);
  }

  @Patch('courier-partners/:id')
  @RequirePermission('manage', 'transport')
  public updatePartner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpsertCourierPartnerDto,
  ) {
    return this.catalog.updatePartner(id, body);
  }

  @Delete('courier-partners/:id')
  @RequirePermission('manage', 'transport')
  public deletePartner(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.softDeletePartner(id);
  }

  @Get('inter-county/routes')
  @RequirePermission('manage', 'transport')
  public listRoutes() {
    return this.catalog.adminListRoutes();
  }

  @Post('inter-county/routes')
  @RequirePermission('manage', 'transport')
  public createRoute(@Body() body: UpsertInterCountyRouteDto) {
    return this.catalog.createRoute(body);
  }

  @Patch('inter-county/routes/:id')
  @RequirePermission('manage', 'transport')
  public updateRoute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpsertInterCountyRouteDto,
  ) {
    return this.catalog.updateRoute(id, body);
  }

  @Delete('inter-county/routes/:id')
  @RequirePermission('manage', 'transport')
  public deleteRoute(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.softDeleteRoute(id);
  }
}
