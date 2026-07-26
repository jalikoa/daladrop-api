import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NearbyRidersQueryDto } from '../dto/transport.dto';
import { RidersDiscoveryService } from '../use-cases/riders-discovery.service';

/** Nearby / nearest are public discovery endpoints (no Bearer required). */
@ApiTags('Transport')
@Controller({ path: 'riders', version: '1' })
export class RidersController {
  public constructor(private readonly discovery: RidersDiscoveryService) {}

  @Get('nearby')
  public nearby(@Query() query: NearbyRidersQueryDto) {
    return this.discovery.nearby(query.lat, query.lng, query.radius);
  }

  /** Uidocs / frontend alias for nearby riders. */
  @Get('nearest')
  public nearest(@Query() query: NearbyRidersQueryDto) {
    return this.discovery.nearby(query.lat, query.lng, query.radius);
  }
}
