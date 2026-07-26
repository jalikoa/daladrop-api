import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ModuleType } from '@prisma/client';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import {
  PayOrderDto,
  RateOrderDto,
  UpdateOrderStatusDto,
} from '../dto/orders.dto';
import { ModuleOrdersService } from '../use-cases/module-orders.service';

@ApiTags('Food Orders')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'food-orders', version: '1' })
export class FoodOrdersController {
  public constructor(private readonly orders: ModuleOrdersService) {}

  @Get(':id')
  public get(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.getById(ModuleType.FOOD, id, principal);
  }

  @Post(':id/pay')
  public pay(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PayOrderDto,
  ) {
    return this.orders.pay(ModuleType.FOOD, id, principal, body);
  }

  @Patch(':id/status')
  public status(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(ModuleType.FOOD, id, principal, body);
  }

  @Post(':id/rate')
  public rate(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RateOrderDto,
  ) {
    return this.orders.rate(ModuleType.FOOD, id, principal, body);
  }
}

@ApiTags('Market Orders')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'market-orders', version: '1' })
export class MarketOrdersController {
  public constructor(private readonly orders: ModuleOrdersService) {}

  @Get(':id')
  public get(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.getById(ModuleType.MARKET, id, principal);
  }

  @Post(':id/pay')
  public pay(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PayOrderDto,
  ) {
    return this.orders.pay(ModuleType.MARKET, id, principal, body);
  }

  @Patch(':id/status')
  public status(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(ModuleType.MARKET, id, principal, body);
  }

  @Post(':id/rate')
  public rate(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RateOrderDto,
  ) {
    return this.orders.rate(ModuleType.MARKET, id, principal, body);
  }
}

@ApiTags('Liquor Orders')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'liquor-orders', version: '1' })
export class LiquorOrdersController {
  public constructor(private readonly orders: ModuleOrdersService) {}

  @Get(':id')
  public get(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.getById(ModuleType.LIQUOR, id, principal);
  }

  @Post(':id/pay')
  public pay(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PayOrderDto,
  ) {
    return this.orders.pay(ModuleType.LIQUOR, id, principal, body);
  }

  @Patch(':id/status')
  public status(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(ModuleType.LIQUOR, id, principal, body);
  }

  @Post(':id/rate')
  public rate(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RateOrderDto,
  ) {
    return this.orders.rate(ModuleType.LIQUOR, id, principal, body);
  }
}

@ApiTags('Gas Orders')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'gas-orders', version: '1' })
export class GasOrdersController {
  public constructor(private readonly orders: ModuleOrdersService) {}

  @Get(':id')
  public get(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.getById(ModuleType.GAS, id, principal);
  }

  @Post(':id/pay')
  public pay(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PayOrderDto,
  ) {
    return this.orders.pay(ModuleType.GAS, id, principal, body);
  }

  @Patch(':id/status')
  public status(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(ModuleType.GAS, id, principal, body);
  }

  @Post(':id/rate')
  public rate(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RateOrderDto,
  ) {
    return this.orders.rate(ModuleType.GAS, id, principal, body);
  }
}
