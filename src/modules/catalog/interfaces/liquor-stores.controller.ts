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

@ApiTags('Liquor Stores')
@UseGuards(OptionalAuthGuard)
@Controller({ path: 'liquor-stores', version: '1' })
export class LiquorStoresController {
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
      this.categories.listPublic(ModuleType.LIQUOR, StoreType.LIQUOR),
      this.discovery.list(
        StoreType.LIQUOR,
        { ...query, page: '1' },
        principal?.id,
      ),
      this.products.popularForFeed(
        StoreType.LIQUOR,
        query,
        principal?.id,
      ),
    ]);
    const topStores = (storeResult.stores ?? storeResult.items).map((store) => ({
      ...store,
      ageRestricted: true,
    }));
    return {
      ...categoryResult,
      popularPicks: popularPicks.map((item) => ({
        ...item,
        ageRestricted: true,
      })),
      featuredProducts: popularPicks.map((item) => ({
        ...item,
        ageRestricted: true,
      })),
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
    return this.categories.listPublic(ModuleType.LIQUOR, StoreType.LIQUOR);
  }

  @Get('products')
  public listProducts(
    @Query() query: VerticalProductQueryDto,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    return this.products.list(StoreType.LIQUOR, query, principal?.id);
  }

  @Get('products/:id')
  public getProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    return this.products.getProduct(id, principal?.id);
  }

  @Get(':id')
  public async getDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    const [detail, products] = await Promise.all([
      this.discovery.getDetail(StoreType.LIQUOR, id, principal?.id),
      this.products.snapshotForStore(id, principal?.id, 20),
    ]);
    return {
      ...detail,
      store: detail.store
        ? { ...detail.store, ageRestricted: true }
        : detail.store,
      products: products.map((item) => ({ ...item, ageRestricted: true })),
    };
  }
}
