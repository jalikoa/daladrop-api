import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { OperationsModule } from '../operations/operations.module';
import { RestaurantsController } from './interfaces/restaurants.controller';
import { MerchantsController } from './interfaces/merchants.controller';
import { AdminMerchantsController } from './interfaces/admin-merchants.controller';
import { AdminStoresController } from './interfaces/admin-stores.controller';
import { MerchantPortalController } from './interfaces/merchant-portal.controller';
import { StoresCheckController } from './interfaces/stores-check.controller';
import { RestaurantDiscoveryService } from './use-cases/restaurant-discovery.service';
import { VerticalStoreDiscoveryService } from './use-cases/vertical-store-discovery.service';
import { MerchantDiscoveryService } from './use-cases/merchant-discovery.service';
import { AdminMerchantsService } from './use-cases/admin-merchants.service';
import { AdminStoresService } from './use-cases/admin-stores.service';
import { MerchantKycService } from './use-cases/merchant-kyc.service';
import { MerchantPortalService } from './use-cases/merchant-portal.service';
import { MerchantSelfService } from './use-cases/merchant-self.service';

@Module({
  imports: [IdentityModule, AuthorizationModule, OperationsModule],
  controllers: [
    RestaurantsController,
    MerchantsController,
    MerchantPortalController,
    StoresCheckController,
    AdminMerchantsController,
    AdminStoresController,
  ],
  providers: [
    RestaurantDiscoveryService,
    VerticalStoreDiscoveryService,
    MerchantDiscoveryService,
    AdminMerchantsService,
    AdminStoresService,
    MerchantKycService,
    MerchantPortalService,
    MerchantSelfService,
  ],
  exports: [
    RestaurantDiscoveryService,
    VerticalStoreDiscoveryService,
    MerchantDiscoveryService,
    AdminMerchantsService,
    AdminStoresService,
    MerchantKycService,
    MerchantPortalService,
    MerchantSelfService,
  ],
})
export class MerchantsModule {}
