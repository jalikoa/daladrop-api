import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { IdentityModule } from '../identity/identity.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { OperationsModule } from '../operations/operations.module';
import { AdminCatalogController } from './interfaces/admin-catalog.controller';
import { FoodController } from './interfaces/food.controller';
import { GasDeliveryController } from './interfaces/gas-delivery.controller';
import { LiquorStoresController } from './interfaces/liquor-stores.controller';
import { LocalMarketsController } from './interfaces/local-markets.controller';
import { RestaurantMenuController } from './interfaces/restaurants-menu.controller';
import { AdminMenuService } from './use-cases/admin-menu.service';
import { AdminProductsService } from './use-cases/admin-products.service';
import { FoodCategoriesService } from './use-cases/food-categories.service';
import { ModuleCategoriesService } from './use-cases/module-categories.service';
import { RestaurantMenuService } from './use-cases/restaurant-menu.service';
import { StoreProductsService } from './use-cases/store-products.service';

@Module({
  imports: [
    IdentityModule,
    AuthorizationModule,
    MerchantsModule,
    OperationsModule,
  ],
  controllers: [
    FoodController,
    RestaurantMenuController,
    LocalMarketsController,
    LiquorStoresController,
    GasDeliveryController,
    AdminCatalogController,
  ],
  providers: [
    FoodCategoriesService,
    ModuleCategoriesService,
    RestaurantMenuService,
    AdminMenuService,
    StoreProductsService,
    AdminProductsService,
  ],
  exports: [
    FoodCategoriesService,
    ModuleCategoriesService,
    RestaurantMenuService,
    StoreProductsService,
  ],
})
export class CatalogModule {}
