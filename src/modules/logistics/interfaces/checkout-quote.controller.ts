import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { CheckoutQuoteDto } from '../dto/logistics.dto';
import { QuoteEngineService } from '../use-cases/quote-engine.service';

@ApiTags('Checkout')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'checkout', version: '1' })
export class CheckoutQuoteController {
  public constructor(private readonly quotes: QuoteEngineService) {}

  @Post('quote')
  public async quote(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: CheckoutQuoteDto,
  ) {
    const cylinderTypeId =
      body.items?.find((item) => item.cylinderTypeId)?.cylinderTypeId ?? null;
    const deliveryLat = body.deliveryLat ?? body.lat;
    const deliveryLng = body.deliveryLng ?? body.lng;
    if (deliveryLat == null || deliveryLng == null) {
      throw new BadRequestException(
        'lat/lng or deliveryLat/deliveryLng is required',
      );
    }
    const subtotalAmount = Array.isArray(body.items)
      ? body.items.reduce(
          (sum, item) =>
            sum +
            Math.round(
              Number(
                (item as { price?: number; unitPrice?: number }).unitPrice ??
                  (item as { price?: number }).price ??
                  0,
              ),
            ) *
              Math.max(1, Number((item as { quantity?: number }).quantity ?? 1)),
          0,
        )
      : undefined;

    return this.quotes.quoteCheckout({
      customerId: principal.id,
      vendorType: body.vendorType,
      vendorId: body.vendorId,
      deliveryLat,
      deliveryLng,
      cylinderTypeId,
      subtotalAmount,
      couponCode: (body as { couponCode?: string }).couponCode,
      walletCreditKes: (body as { walletCreditKes?: number }).walletCreditKes,
    });
  }
}
