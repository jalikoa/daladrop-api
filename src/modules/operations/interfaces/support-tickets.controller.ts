import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupportTicketStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import {
  AddSupportAttachmentDto,
  AssignSupportTicketDto,
  CreateSupportTicketDto,
  InternalNoteDto,
  MergeSupportTicketDto,
  PaginationQueryDto,
  ReplySupportTicketDto,
  SetSupportPriorityDto,
  UpdateSupportTicketDto,
} from '../dto/operations.dto';
import { SupportTicketsService } from '../use-cases/support-tickets.service';

class AdminListTicketsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;
}

@ApiTags('Support')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'support/tickets', version: '1' })
export class SupportTicketsController {
  public constructor(private readonly tickets: SupportTicketsService) {}

  @Post()
  public create(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: CreateSupportTicketDto,
  ) {
    return this.tickets.create(principal.id, body);
  }

  @Get()
  public listMine(
    @CurrentAuth() principal: AuthPrincipalView,
    @Query() query: PaginationQueryDto,
  ) {
    return this.tickets.listMine(principal.id, query);
  }

  @Get(':id')
  public getMine(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tickets.getMine(principal.id, id);
  }

  @Post(':id/replies')
  public reply(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReplySupportTicketDto,
  ) {
    return this.tickets.reply(principal.id, id, {
      body: body.body,
      role: 'customer',
    });
  }

  @Post(':id/attachments')
  public addAttachment(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddSupportAttachmentDto,
  ) {
    return this.tickets.addAttachment(principal.id, id, body);
  }

  @Post(':id/close')
  public close(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tickets.close(principal.id, id);
  }

  @Post(':id/reopen')
  public reopen(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tickets.reopen(principal.id, id);
  }

  @Post(':id/cancel')
  public cancel(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tickets.cancel(principal.id, id);
  }
}

@ApiTags('Merchant Support')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'merchant/support/tickets', version: '1' })
export class MerchantSupportTicketsController {
  public constructor(private readonly tickets: SupportTicketsService) {}

  @Get()
  public list(
    @CurrentAuth() principal: AuthPrincipalView,
    @Query('merchantId', ParseUUIDPipe) merchantId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.tickets.listForMerchant(principal.id, merchantId, query);
  }

  @Post()
  public create(
    @CurrentAuth() principal: AuthPrincipalView,
    @Query('merchantId', ParseUUIDPipe) merchantId: string,
    @Body() body: CreateSupportTicketDto,
  ) {
    return this.tickets.createForMerchant(principal.id, merchantId, body);
  }

  @Get(':id')
  public get(
    @CurrentAuth() principal: AuthPrincipalView,
    @Query('merchantId', ParseUUIDPipe) merchantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tickets.getForMerchant(principal.id, merchantId, id);
  }

  @Post(':id/replies')
  public reply(
    @CurrentAuth() principal: AuthPrincipalView,
    @Query('merchantId', ParseUUIDPipe) merchantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReplySupportTicketDto,
  ) {
    return this.tickets.reply(principal.id, id, {
      body: body.body,
      role: 'merchant',
      merchantId,
    });
  }
}

@ApiTags('Admin Support')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/support/tickets', version: '1' })
export class AdminSupportTicketsController {
  public constructor(private readonly tickets: SupportTicketsService) {}

  @Get()
  @RequirePermission('read', 'support')
  public list(@Query() query: AdminListTicketsQueryDto) {
    return this.tickets.adminList(query);
  }

  @Get(':id')
  @RequirePermission('read', 'support')
  public get(@Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.adminGet(id);
  }

  @Patch(':id')
  @RequirePermission('manage', 'support')
  public update(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSupportTicketDto,
  ) {
    return this.tickets.adminUpdate(id, body, principal.id);
  }

  @Post(':id/assign')
  @RequirePermission('manage', 'support')
  public assign(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignSupportTicketDto,
  ) {
    return this.tickets.assign(id, body.assignedTo, principal.id);
  }

  @Post(':id/reassign')
  @RequirePermission('manage', 'support')
  public reassign(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignSupportTicketDto,
  ) {
    return this.tickets.reassign(id, body.assignedTo, principal.id);
  }

  @Post(':id/escalate')
  @RequirePermission('manage', 'support')
  public escalate(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tickets.escalate(id, principal.id);
  }

  @Post(':id/merge')
  @RequirePermission('manage', 'support')
  public merge(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MergeSupportTicketDto,
  ) {
    return this.tickets.merge(id, body.targetTicketId, principal.id);
  }

  @Post(':id/resolve')
  @RequirePermission('manage', 'support')
  public resolve(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tickets.resolve(id, principal.id);
  }

  @Post(':id/priority')
  @RequirePermission('manage', 'support')
  public setPriority(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetSupportPriorityDto,
  ) {
    return this.tickets.setPriority(id, body.priority, principal.id);
  }

  @Post(':id/internal-notes')
  @RequirePermission('manage', 'support')
  public internalNote(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: InternalNoteDto,
  ) {
    return this.tickets.internalNote(principal.id, id, body.body);
  }

  @Post(':id/replies')
  @RequirePermission('manage', 'support')
  public reply(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReplySupportTicketDto,
  ) {
    return this.tickets.reply(principal.id, id, {
      body: body.body,
      role: 'admin',
    });
  }

  @Post(':id/attachments')
  @RequirePermission('manage', 'support')
  public addAttachment(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddSupportAttachmentDto,
  ) {
    return this.tickets.addAttachment(principal.id, id, {
      ...body,
      asAdmin: true,
    });
  }
}
