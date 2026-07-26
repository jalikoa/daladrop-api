import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TransportCatalogService } from '../use-cases/transport-catalog.service';

/** Public catalog reads — no auth required (mirrors `/events/categories`). */
@ApiTags('Transport')
@Controller({ path: 'transport', version: '1' })
export class TransportCatalogController {
  public constructor(private readonly catalog: TransportCatalogService) {}

  @Get('courier-partners')
  public courierPartners() {
    return this.catalog.courierPartners();
  }

  @Get('inter-county/routes')
  public interCountyRoutes() {
    return this.catalog.interCountyRoutes();
  }
}
