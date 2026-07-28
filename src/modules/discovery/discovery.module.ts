import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule as BullMqModule } from '@nestjs/bullmq';
import { redisConnectionFromConfig } from '../../config/redis-connection';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CatalogModule } from '../catalog/catalog.module';
import { IdentityModule } from '../identity/identity.module';
import { LogisticsModule } from '../logistics/logistics.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { SEARCH_INDEX_QUEUE } from './constants/search-index.constants';
import { AdminSearchController } from './interfaces/admin-search.controller';
import { ConfigPricingController } from './interfaces/config-pricing.controller';
import { DiscoveryFeedController } from './interfaces/discovery-feed.controller';
import { SearchController } from './interfaces/search.controller';
import { SearchIndexListener } from './listeners/search-index.listener';
import { SearchIndexProcessor } from './processors/search-index.processor';
import { ConfigPricingService } from './use-cases/config-pricing.service';
import { SearchIndexerService } from './use-cases/search-indexer.service';
import { UniversalSearchService } from './use-cases/universal-search.service';

@Module({
  imports: [
    LogisticsModule,
    IdentityModule,
    AuthorizationModule,
    MerchantsModule,
    CatalogModule,
    BullMqModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnectionFromConfig(config, {
          maxRetriesPerRequest: null,
        }),
      }),
    }),
    BullMqModule.registerQueue({ name: SEARCH_INDEX_QUEUE }),
  ],
  controllers: [
    ConfigPricingController,
    SearchController,
    AdminSearchController,
    DiscoveryFeedController,
  ],
  providers: [
    ConfigPricingService,
    SearchIndexerService,
    UniversalSearchService,
    SearchIndexProcessor,
    SearchIndexListener,
  ],
  exports: [ConfigPricingService, UniversalSearchService, SearchIndexerService],
})
export class DiscoveryModule {}
