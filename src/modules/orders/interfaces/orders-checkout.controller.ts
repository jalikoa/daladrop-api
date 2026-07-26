import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ModuleType } from '@prisma/client';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import {
  FoodCreateAndPayDto,
  MultiCheckoutDto,
  resolveDeliveryCoordinates,
} from '../dto/orders.dto';
import { MultiCheckoutService } from '../use-cases/multi-checkout.service';

@ApiTags('Orders Checkout')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'orders', version: '1' })
export class OrdersCheckoutController {
  public constructor(private readonly checkout: MultiCheckoutService) {}

  @Post('food/multi-checkout')
  public foodMulti(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: MultiCheckoutDto,
  ) {
    return this.checkout.place(ModuleType.FOOD, principal, body);
  }

  @Post('markets/multi-checkout')
  public marketsMulti(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: MultiCheckoutDto,
  ) {
    return this.checkout.place(ModuleType.MARKET, principal, body);
  }

  @Post('liquor/multi-checkout')
  public liquorMulti(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: MultiCheckoutDto,
  ) {
    return this.checkout.place(ModuleType.LIQUOR, principal, body);
  }

  @Post('gas/multi-checkout')
  public gasMulti(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: MultiCheckoutDto,
  ) {
    return this.checkout.place(ModuleType.GAS, principal, body);
  }

  /**
   * Legacy food create-and-pay: creates a single vendor order then optionally pays
   * when phone is provided. Prefer multi-checkout + pay for new clients.
   */
  @Post('food/create-and-pay')
  public async foodCreateAndPay(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: FoodCreateAndPayDto,
  ) {
    const orders =
      body.orders && body.orders.length > 0
        ? body.orders
        : [
            {
              restaurantId: body.restaurantId,
              storeId: body.restaurantId,
              items: body.items ?? [],
            },
          ];
    if (!orders[0]?.items?.length) {
      throw new BadRequestException('items or orders required');
    }
    const { lat, lng } = resolveDeliveryCoordinates(body);
    const placed = await this.checkout.place(ModuleType.FOOD, principal, {
      customerId: body.customerId,
      orders,
      deliveryAddress: body.deliveryAddress,
      lat,
      lng,
      notes: body.notes,
      mpesaPhone: body.mpesaPhone,
      phone: body.phone,
    });

    const phone = body.mpesaPhone ?? body.phone;
    if (placed.orderIds.length === 1 && phone && !placed.mpesa.initiated) {
      const pay = await this.checkout.initiateOrderPayment(
        placed.orderIds[0]!,
        body.customerId,
        phone,
      );
      return {
        ...placed,
        checkoutRequestId: pay.checkoutRequestId,
        mpesa: { initiated: pay.initiated },
        paymentStatus: pay.initiated ? 'PROCESSING' : placed.paymentStatus,
      };
    }
    return placed;
  }
}
