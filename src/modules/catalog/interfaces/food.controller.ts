import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OptionalCurrentAuth } from '../../identity/decorators/optional-current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { OptionalAuthGuard } from '../../identity/guards/optional-auth.guard';
import { RestaurantDiscoveryService } from '../../merchants/use-cases/restaurant-discovery.service';
import { RestaurantListQueryDto } from '../../merchants/dto/merchants.dto';
import { FoodCategoriesService } from '../use-cases/food-categories.service';

@ApiTags('Food')
@Controller({ path: 'food', version: '1' })
export class FoodController {
  public constructor(
    private readonly categories: FoodCategoriesService,
    private readonly discovery: RestaurantDiscoveryService,
  ) {}

  @Get('categories')
  public listCategories() {
    return this.categories.listPublic();
  }

  @Get('feed')
  @UseGuards(OptionalAuthGuard)
  public async feed(
    @Query() query: RestaurantListQueryDto,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    const [categoryResult, restaurantResult] = await Promise.all([
      this.categories.listPublic(),
      this.discovery.list({ ...query, page: '1' }, principal?.id),
    ]);
    return {
      success: true as const,
      ...categoryResult,
      ...restaurantResult,
      restaurants: restaurantResult.items,
      banners: [],
    };
  }
}
