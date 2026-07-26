import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ModuleType, StoreType } from '@prisma/client';
import { OptionalCurrentAuth } from '../../identity/decorators/optional-current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { OptionalAuthGuard } from '../../identity/guards/optional-auth.guard';
import { VerticalStoreDiscoveryService } from '../../merchants/use-cases/vertical-store-discovery.service';
import { VerticalProductQueryDto } from '../dto/catalog.dto';
import { ModuleCategoriesService } from '../use-cases/module-categories.service';
import { StoreProductsService } from '../use-cases/store-products.service';

@ApiTags('Local Markets')
@UseGuards(OptionalAuthGuard)
@Controller({ path: 'local-markets', version: '1' })
export class LocalMarketsController {
  public constructor(
    private readonly categories: ModuleCategoriesService,
    private readonly products: StoreProductsService,
    private readonly discovery: VerticalStoreDiscoveryService,
  ) {}

  @Get('feed')
  public async feed(
    @Query() query: VerticalProductQueryDto,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    const [categoryResult, marketResult, popularPicks] = await Promise.all([
      this.categories.listPublic(ModuleType.MARKET, StoreType.MARKET),
      this.discovery.list(
        StoreType.MARKET,
        { ...query, page: '1' },
        principal?.id,
      ),
      this.products.popularForFeed(
        StoreType.MARKET,
        query,
        principal?.id,
      ),
    ]);
    return {
      ...categoryResult,
      topMarkets: marketResult.markets ?? marketResult.items,
      markets: marketResult.markets ?? marketResult.items,
      items: marketResult.items,
      page: marketResult.page,
      hasMore: marketResult.hasMore,
      total: marketResult.total,
      popularPicks,
      banners: [],
    };
  }

  @Get('categories')
  public listCategories() {
    return this.categories.listPublic(ModuleType.MARKET, StoreType.MARKET);
  }

  @Get()
  public list(
    @Query() query: VerticalProductQueryDto,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    return this.discovery.list(StoreType.MARKET, query, principal?.id);
  }

  @Get(':id/products')
  public listProducts(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: VerticalProductQueryDto,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    return this.products.listByStore(id, query, principal?.id);
  }

  @Get(':id')
  public async getDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    const [detail, products] = await Promise.all([
      this.discovery.getDetail(StoreType.MARKET, id, principal?.id),
      this.products.snapshotForStore(id, principal?.id, 20),
    ]);
    return {
      ...detail,
      products,
    };
  }
}
