import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActorType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import { OptionalCurrentAuth } from '../../identity/decorators/optional-current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { OptionalAuthGuard } from '../../identity/guards/optional-auth.guard';
import {
  CreateRideDto,
  PayRideDto,
  RideQuoteDto,
  UpdateRideStatusByBodyDto,
} from '../dto/transport.dto';
import { RideDispatchService } from '../use-cases/ride-dispatch.service';
import { RidesService } from '../use-cases/rides.service';

const RIDE_ADMIN_ROLES = new Set(['ADMIN', 'SUPPORT', 'SYSTEM']);

/**
 * `/v1/ride/*` — singular resource: quote, create/request, pay lifecycle, get.
 * Cancel/share/rate live on the plural `/v1/rides/*` controller (Uidocs
 * duplication the frontend still relies on — see `23-known-frontend-assumptions.md`).
 */
@ApiTags('Transport')
@ApiBearerAuth()
@Controller({ path: 'ride', version: '1' })
export class RideController {
  public constructor(
    private readonly rides: RidesService,
    private readonly dispatch: RideDispatchService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Quote is publicly readable for browse UX; when authenticated the quote is
   * bound to the caller so it cannot be stolen for fare underpayment.
   */
  @Post('quote')
  @UseGuards(OptionalAuthGuard)
  public quote(
    @OptionalCurrentAuth() principal: AuthPrincipalView | undefined,
    @Body() body: RideQuoteDto,
  ) {
    return this.rides.quote(body, principal?.id);
  }

  @Post('create-and-pay')
  @UseGuards(AuthTokenGuard)
  public createAndPay(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: CreateRideDto,
  ) {
    return this.rides.createAndPay(principal.id, body);
  }

  @Post('request')
  @UseGuards(AuthTokenGuard)
  public request(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: CreateRideDto,
  ) {
    return this.rides.request(principal.id, body);
  }

  @Get(':id')
  @UseGuards(AuthTokenGuard)
  public getRide(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rides.getRide(id, principal.id);
  }

  /**
   * Legacy vendor/rider dashboard alias — `POST /ride/update-status` with
   * `rideId` in the body. Assigned rider or admin/support only.
   */
  @Post('update-status')
  @UseGuards(AuthTokenGuard)
  @ApiOperation({ summary: 'Update ride status (assigned rider or admin)' })
  public async updateStatus(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: UpdateRideStatusByBodyDto,
  ) {
    const ride = await this.prisma.ride.findFirst({
      where: { id: body.rideId, deletedAt: null },
      select: { id: true, riderId: true },
    });
    if (!ride) throw new NotFoundException('Ride not found');

    const isAdmin = principal.roles.some((role) => RIDE_ADMIN_ROLES.has(role));
    let role: 'RIDER' | 'ADMIN' = 'ADMIN';
    if (!isAdmin) {
      const rider = await this.prisma.rider.findFirst({
        where: { userId: principal.id, deletedAt: null },
        select: { id: true },
      });
      if (!rider || ride.riderId !== rider.id) {
        throw new ForbiddenException('Ride is not assigned to this rider');
      }
      role = 'RIDER';
    }

    const rideView = await this.dispatch.updateStatus(
      body.rideId,
      body.status,
      { actorId: principal.id, actorType: ActorType.USER, role },
      body.reason,
      {
        podPhotoUrl: body.podPhotoUrl,
        podSignatureUrl: body.podSignatureUrl,
        podNotes: body.podNotes,
      },
    );
    return { success: true as const, ride: rideView };
  }

  @Post(':id/pay')
  @UseGuards(AuthTokenGuard)
  public pay(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PayRideDto,
  ) {
    return this.rides.pay(id, principal.id, body);
  }

  @Post(':id/retry-payment')
  @UseGuards(AuthTokenGuard)
  public retryPayment(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rides.retryPayment(id, principal.id);
  }

  @Post(':id/cancel-unpaid')
  @UseGuards(AuthTokenGuard)
  public cancelUnpaid(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rides.cancelUnpaid(id, principal.id);
  }
}
