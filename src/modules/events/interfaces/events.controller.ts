import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { OptionalAuthGuard } from '../../identity/guards/optional-auth.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import { OptionalCurrentAuth } from '../../identity/decorators/optional-current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { BuyTicketDto, EventListQueryDto, PayBookingDto } from '../dto/events.dto';
import { EventsDiscoveryService } from '../use-cases/events-discovery.service';
import { EventBookingService } from '../use-cases/event-booking.service';

@ApiTags('Events')
@Controller({ path: 'events', version: '1' })
export class EventsController {
  public constructor(
    private readonly discovery: EventsDiscoveryService,
    private readonly booking: EventBookingService,
  ) {}

  @Get('feed')
  @UseGuards(OptionalAuthGuard)
  public feed(
    @Query() query: EventListQueryDto,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    return this.discovery.feed(query, principal?.id);
  }

  @Get('categories')
  public categories() {
    return this.discovery.listCategories();
  }

  @Get('my-tickets')
  @ApiBearerAuth()
  @UseGuards(AuthTokenGuard)
  public myTickets(@CurrentAuth() principal: AuthPrincipalView) {
    return this.booking.myTickets(principal.id);
  }

  @Get('bookings/:id')
  @ApiBearerAuth()
  @UseGuards(AuthTokenGuard)
  public getBooking(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.booking.getBooking(id, principal.id);
  }

  @Post('bookings/:id/pay')
  @ApiBearerAuth()
  @UseGuards(AuthTokenGuard)
  public pay(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PayBookingDto,
  ) {
    return this.booking.pay(id, principal.id, body);
  }

  @Get()
  @UseGuards(OptionalAuthGuard)
  public list(
    @Query() query: EventListQueryDto,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    return this.discovery.list(query, principal?.id);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  public getById(
    @Param('id', ParseUUIDPipe) id: string,
    @OptionalCurrentAuth() principal?: AuthPrincipalView,
  ) {
    return this.discovery.getById(id, principal?.id);
  }

  @Post(':id/buy')
  @ApiBearerAuth()
  @UseGuards(AuthTokenGuard)
  public buy(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: BuyTicketDto,
  ) {
    return this.booking.buy(id, principal.id, body);
  }
}
