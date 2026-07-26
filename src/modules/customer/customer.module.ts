import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { CustomerController } from './interfaces/customer.controller';
import { CustomerPlacesService } from './use-cases/customer-places.service';
import { CustomerActivityService } from './use-cases/customer-activity.service';
import { CustomerSavedItemsService } from './use-cases/customer-saved-items.service';
import { CustomerMenuFavouritesService } from './use-cases/customer-menu-favourites.service';

@Module({
  imports: [IdentityModule],
  controllers: [CustomerController],
  providers: [
    CustomerPlacesService,
    CustomerActivityService,
    CustomerSavedItemsService,
    CustomerMenuFavouritesService,
  ],
  exports: [
    CustomerPlacesService,
    CustomerActivityService,
    CustomerSavedItemsService,
    CustomerMenuFavouritesService,
  ],
})
export class CustomerModule {}
