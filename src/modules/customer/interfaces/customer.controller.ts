import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { PutSavedPlacesDto } from '../dto/saved-places.dto';
import {
  CreateSavedItemDto,
  ListFavouritesQueryDto,
  ListSavedItemsQueryDto,
} from '../dto/saved-items.dto';
import { CreateMenuFavouriteDto } from '../dto/menu-favourites.dto';
import { CustomerPlacesService } from '../use-cases/customer-places.service';
import { CustomerActivityService } from '../use-cases/customer-activity.service';
import { CustomerSavedItemsService } from '../use-cases/customer-saved-items.service';
import { CustomerMenuFavouritesService } from '../use-cases/customer-menu-favourites.service';

@ApiTags('Customer')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'customer', version: '1' })
export class CustomerController {
  public constructor(
    private readonly places: CustomerPlacesService,
    private readonly activity: CustomerActivityService,
    private readonly savedItems: CustomerSavedItemsService,
    private readonly menuFavourites: CustomerMenuFavouritesService,
  ) {}

  @Get('me/places')
  public listPlaces(@CurrentAuth() principal: AuthPrincipalView) {
    return this.places.list(principal.id);
  }

  @Put('me/places')
  public replacePlaces(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() input: PutSavedPlacesDto,
  ) {
    return this.places.replace(principal.id, input);
  }

  @Get(':userId/saved-items')
  public listSavedItems(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: ListSavedItemsQueryDto,
  ) {
    return this.savedItems.list(principal.id, userId, query.type, query);
  }

  @Post(':userId/saved-items')
  public async addSavedItem(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: CreateSavedItemDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.savedItems.add(
      principal.id,
      userId,
      body.type,
      body.id,
    );
    res.status(result.statusCode);
    return result.body;
  }

  @Delete(':userId/saved-items/:type/:targetId')
  public async removeSavedItem(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('type') type: string,
    @Param('targetId', ParseUUIDPipe) targetId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.savedItems.remove(
      principal.id,
      userId,
      type,
      targetId,
    );
    res.status(result.statusCode);
  }

  @Get(':userId/favorites')
  public listFavorites(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: ListFavouritesQueryDto,
  ) {
    return this.menuFavourites.list(principal.id, userId, query);
  }

  @Post(':userId/favorites')
  public async addFavorite(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: CreateMenuFavouriteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.menuFavourites.add(
      principal.id,
      userId,
      body.menuItemId,
    );
    res.status(result.statusCode);
    return result.body;
  }

  @Delete(':userId/favorites/:menuItemId')
  public async removeFavorite(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('menuItemId', ParseUUIDPipe) menuItemId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.menuFavourites.remove(
      principal.id,
      userId,
      menuItemId,
    );
    res.status(result.statusCode);
  }

  @Get(':userId/history')
  public history(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.activity.history(principal.id, userId);
  }

  @Delete(':userId/history/:rideId')
  public hideHistoryItem(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('rideId', ParseUUIDPipe) rideId: string,
  ) {
    return this.activity.hideHistoryItem(principal.id, userId, rideId);
  }

  @Delete(':userId/order-history/:orderId')
  public hideOrderHistoryItem(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.activity.hideOrderHistoryItem(principal.id, userId, orderId);
  }

  /** Uidocs 08 alias — soft-hide a single food order from history. */
  @Delete(':userId/food-orders/:orderId')
  public hideFoodOrderHistoryItem(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.activity.hideOrderHistoryItem(principal.id, userId, orderId);
  }

  @Delete(':userId/market-orders/:orderId')
  public hideMarketOrderHistoryItem(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.activity.hideOrderHistoryItem(principal.id, userId, orderId);
  }

  @Delete(':userId/liquor-orders/:orderId')
  public hideLiquorOrderHistoryItem(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.activity.hideOrderHistoryItem(principal.id, userId, orderId);
  }

  @Delete(':userId/gas-orders/:orderId')
  public hideGasOrderHistoryItem(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.activity.hideOrderHistoryItem(principal.id, userId, orderId);
  }

  @Delete(':userId/history')
  public hideAllHistory(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.activity.hideAllHistory(principal.id, userId);
  }

  @Get(':userId/stats')
  public stats(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.activity.stats(principal.id, userId);
  }
}
