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

@ApiTags('Gas Delivery')
@UseGuards(OptionalAuthGuard)
@Controller({ path: 'gas-delivery', version: '1' })
export class GasDeliveryController {
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
    const [categoryResult, storeResult, popularPicks] = await Promise.all([
      this.categories.listPublic(ModuleType.GAS, StoreType.GAS),
      this.discovery.list(
        StoreType.GAS,
        { ...query, page: '1' },
        principal?.id,
      ),
      this.products.popularForFeed(StoreType.GAS, query, principal?.id),
    ]);
    const topStores = storeResult.stores ?? storeResult.items;
    return {
      ...categoryResult,
      popularPicks,
      featuredProducts: popularPicks,
      topStores,
      stores: topStores,
      items: topStores,
      page: storeResult.page,
      hasMore: storeResult.hasMore,
      total: storeResult.total,
      banners: [],
    };
  }

  @Get('categories')
  public listCategories() {
    return this.categories.listPublic(ModuleType.GAS, StoreType.GAS);
  }

  @Get('products')
  public listProducts(
    @Query() query: VerticalProductQueryDto,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    return this.products.list(StoreType.GAS, query, principal?.id);
  }

  @Get('stores/:id')
  public async getStoreDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    const [detail, products] = await Promise.all([
      this.discovery.getDetail(StoreType.GAS, id, principal?.id),
      this.products.snapshotForStore(id, principal?.id, 20),
    ]);
    return {
      ...detail,
      products,
    };
  }
}
