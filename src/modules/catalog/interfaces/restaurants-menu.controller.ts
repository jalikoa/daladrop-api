import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OptionalCurrentAuth } from '../../identity/decorators/optional-current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { OptionalAuthGuard } from '../../identity/guards/optional-auth.guard';
import { RestaurantDiscoveryService } from '../../merchants/use-cases/restaurant-discovery.service';
import { RestaurantMenuService } from '../use-cases/restaurant-menu.service';

@ApiTags('Restaurants')
@UseGuards(OptionalAuthGuard)
@Controller({ path: 'restaurants', version: '1' })
export class RestaurantMenuController {
  public constructor(
    private readonly menus: RestaurantMenuService,
    private readonly discovery: RestaurantDiscoveryService,
  ) {}

  /** Preferred UI shape from Uidocs/04-menu.md */
  @Get(':id')
  public async getDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    const [profile, menu] = await Promise.all([
      this.discovery.getProfile(id, principal?.id),
      this.menus.getMenu(id, principal?.id),
    ]);
    return {
      restaurant: profile.restaurant,
      categories: menu.categories,
      items: menu.items,
    };
  }

  @Get(':id/menu')
  public async getMenu(
    @Param('id', ParseUUIDPipe) id: string,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    return this.getDetail(id, principal);
  }
}
