import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { MpesaPaymentStatusService } from '../use-cases/mpesa-payment-status.service';

/**
 * Version-neutral alias for legacy tracking clients that call
 * `GET /api/v1/mpesa/payment-status/:rideId` literally (no `/v1` URI
 * versioning prefix). Requires Bearer + ownership — safer than optional
 * auth for a payment status leak surface.
 */
@ApiTags('M-Pesa')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'api/v1/mpesa', version: VERSION_NEUTRAL })
export class MpesaPaymentStatusNeutralController {
  public constructor(private readonly service: MpesaPaymentStatusService) {}

  @Get('payment-status/:rideId')
  public getStatus(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('rideId', ParseUUIDPipe) rideId: string,
  ) {
    return this.service.getForRide(rideId, principal.id);
  }
}

/** Canonical `GET /v1/mpesa/payment-status/:rideId` — same handler as the alias above. */
@ApiTags('M-Pesa')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'mpesa', version: '1' })
export class MpesaPaymentStatusController {
  public constructor(private readonly service: MpesaPaymentStatusService) {}

  @Get('payment-status/:rideId')
  public getStatus(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('rideId', ParseUUIDPipe) rideId: string,
  ) {
    return this.service.getForRide(rideId, principal.id);
  }
}
