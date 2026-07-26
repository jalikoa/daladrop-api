import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OptionalAuthGuard } from '../../identity/guards/optional-auth.guard';
import { OptionalCurrentAuth } from '../../identity/decorators/optional-current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { MerchantListQueryDto } from '../../merchants/dto/merchants.dto';
import { MerchantDiscoveryService } from '../../merchants/use-cases/merchant-discovery.service';
import { RestaurantDiscoveryService } from '../../merchants/use-cases/restaurant-discovery.service';
import { FoodCategoriesService } from '../../catalog/use-cases/food-categories.service';

/**
 * Home discovery feed — Uidocs / frontend `GET /v1/discovery/feed`.
 */
@ApiTags('Discovery')
@UseGuards(OptionalAuthGuard)
@Controller({ path: 'discovery', version: '1' })
export class DiscoveryFeedController {
  public constructor(
    private readonly merchants: MerchantDiscoveryService,
    private readonly restaurants: RestaurantDiscoveryService,
    private readonly foodCategories: FoodCategoriesService,
  ) {}

  @Get('feed')
  @ApiOperation({ summary: 'Home discovery feed across verticals' })
  public async feed(
    @Query() query: MerchantListQueryDto,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    const [merchantFeed, restaurantFeed, categories] = await Promise.all([
      this.merchants.feed(query, principal?.id),
      this.restaurants.list(
        { ...query, page: '1', limit: query.limit ?? query.pageSize ?? '10' },
        principal?.id,
      ),
      this.foodCategories.listPublic(),
    ]);

    return {
      success: true as const,
      merchants: merchantFeed.merchants,
      restaurants: restaurantFeed.items,
      categories: categories.categories ?? categories,
      featured: merchantFeed.featured,
      recommended: merchantFeed.recommended,
      banners: [],
      page: 1,
      hasMore: merchantFeed.hasMore || restaurantFeed.hasMore,
    };
  }
}
