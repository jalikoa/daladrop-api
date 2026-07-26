import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import {
  CreateEventDto,
  EventCategoryDto,
  EventTicketTypeDto,
  UpdateEventCategoryDto,
  UpdateEventDto,
  UpdateEventTicketTypeDto,
} from '../dto/events.dto';
import { AdminEventsService } from '../use-cases/admin-events.service';

@ApiTags('Admin Events')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin', version: '1' })
export class AdminEventsController {
  public constructor(private readonly events: AdminEventsService) {}

  // Categories
  @Get('event-categories')
  @RequirePermission('read', 'events')
  public listCategories() {
    return this.events.listCategories();
  }

  @Post('event-categories')
  @RequirePermission('manage', 'events')
  public createCategory(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: EventCategoryDto,
  ) {
    return this.events.createCategory(principal.id, body);
  }

  @Patch('event-categories/:id')
  @RequirePermission('manage', 'events')
  public updateCategory(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEventCategoryDto,
  ) {
    return this.events.updateCategory(principal.id, id, body);
  }

  @Delete('event-categories/:id')
  @RequirePermission('manage', 'events')
  public deleteCategory(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.events.deleteCategory(principal.id, id);
  }

  // Events
  @Get('events')
  @RequirePermission('read', 'events')
  public listEvents(@Query('status') status?: string) {
    return this.events.listEvents(status);
  }

  @Get('events/:id')
  @RequirePermission('read', 'events')
  public getEvent(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.getEvent(id);
  }

  @Post('events')
  @RequirePermission('manage', 'events')
  public createEvent(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: CreateEventDto,
  ) {
    return this.events.createEvent(principal.id, body);
  }

  @Patch('events/:id')
  @RequirePermission('manage', 'events')
  public updateEvent(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEventDto,
  ) {
    return this.events.updateEvent(principal.id, id, body);
  }

  @Post('events/:id/publish')
  @RequirePermission('manage', 'events')
  public publishEvent(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.events.publishEvent(principal.id, id);
  }

  @Delete('events/:id')
  @RequirePermission('manage', 'events')
  public deleteEvent(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.events.deleteEvent(principal.id, id);
  }

  // Ticket types
  @Get('events/:eventId/ticket-types')
  @RequirePermission('read', 'events')
  public listTicketTypes(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.events.listTicketTypes(eventId);
  }

  @Post('events/:eventId/ticket-types')
  @RequirePermission('manage', 'events')
  public createTicketType(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: EventTicketTypeDto,
  ) {
    return this.events.createTicketType(principal.id, eventId, body);
  }

  @Patch('events/:eventId/ticket-types/:ticketTypeId')
  @RequirePermission('manage', 'events')
  public updateTicketType(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('ticketTypeId', ParseUUIDPipe) ticketTypeId: string,
    @Body() body: UpdateEventTicketTypeDto,
  ) {
    return this.events.updateTicketType(
      principal.id,
      eventId,
      ticketTypeId,
      body,
    );
  }

  @Delete('events/:eventId/ticket-types/:ticketTypeId')
  @RequirePermission('manage', 'events')
  public deleteTicketType(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('ticketTypeId', ParseUUIDPipe) ticketTypeId: string,
  ) {
    return this.events.deleteTicketType(principal.id, eventId, ticketTypeId);
  }
}
