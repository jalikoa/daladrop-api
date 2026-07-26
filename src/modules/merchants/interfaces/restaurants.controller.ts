import {
  Controller,
  Get,
  HttpCode,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OptionalAuthGuard } from '../../identity/guards/optional-auth.guard';
import { OptionalCurrentAuth } from '../../identity/decorators/optional-current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { RestaurantListQueryDto } from '../dto/merchants.dto';
import { RestaurantDiscoveryService } from '../use-cases/restaurant-discovery.service';

@ApiTags('Restaurants')
@UseGuards(OptionalAuthGuard)
@Controller({ path: 'restaurants', version: '1' })
export class RestaurantsController {
  public constructor(
    private readonly discovery: RestaurantDiscoveryService,
  ) {}

  @Get()
  @HttpCode(200)
  public list(
    @Query() query: RestaurantListQueryDto,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    return this.discovery.list(query, principal?.id);
  }
}
