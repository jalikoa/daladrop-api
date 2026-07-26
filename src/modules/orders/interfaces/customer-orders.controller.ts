import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ModuleType } from '@prisma/client';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { ModuleOrdersService } from '../use-cases/module-orders.service';

@ApiTags('Orders Checkout')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'customer', version: '1' })
export class CustomerOrdersController {
  public constructor(private readonly orders: ModuleOrdersService) {}

  @Get(':uid/food-orders')
  public foodList(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('uid', ParseUUIDPipe) uid: string,
  ) {
    return this.orders.listCustomerHistory(ModuleType.FOOD, uid, principal);
  }

  @Delete(':uid/food-orders')
  public foodHide(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('uid', ParseUUIDPipe) uid: string,
  ) {
    return this.orders.hideCustomerHistory(ModuleType.FOOD, uid, principal);
  }

  @Get(':uid/market-orders')
  public marketList(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('uid', ParseUUIDPipe) uid: string,
  ) {
    return this.orders.listCustomerHistory(ModuleType.MARKET, uid, principal);
  }

  @Delete(':uid/market-orders')
  public marketHide(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('uid', ParseUUIDPipe) uid: string,
  ) {
    return this.orders.hideCustomerHistory(ModuleType.MARKET, uid, principal);
  }

  @Get(':uid/liquor-orders')
  public liquorList(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('uid', ParseUUIDPipe) uid: string,
  ) {
    return this.orders.listCustomerHistory(ModuleType.LIQUOR, uid, principal);
  }

  @Delete(':uid/liquor-orders')
  public liquorHide(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('uid', ParseUUIDPipe) uid: string,
  ) {
    return this.orders.hideCustomerHistory(ModuleType.LIQUOR, uid, principal);
  }

  @Get(':uid/gas-orders')
  public gasList(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('uid', ParseUUIDPipe) uid: string,
  ) {
    return this.orders.listCustomerHistory(ModuleType.GAS, uid, principal);
  }

  @Delete(':uid/gas-orders')
  public gasHide(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('uid', ParseUUIDPipe) uid: string,
  ) {
    return this.orders.hideCustomerHistory(ModuleType.GAS, uid, principal);
  }
}
