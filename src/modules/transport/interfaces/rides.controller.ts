import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CancelRideDto, RateRideDto } from '../dto/transport.dto';
import { RidesService } from '../use-cases/rides.service';

/** `/v1/rides/*` — plural resource alias for live cancel/share/rate. */
@ApiTags('Transport')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'rides', version: '1' })
export class RidesController {
  public constructor(private readonly rides: RidesService) {}

  @Post(':id/cancel')
  public cancel(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelRideDto,
  ) {
    return this.rides.cancel(id, principal.id, body?.reason);
  }

  @Post(':id/share')
  public share(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rides.share(id, principal.id);
  }

  @Post(':id/rate')
  public rate(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RateRideDto,
  ) {
    return this.rides.rate(id, principal.id, body);
  }
}
