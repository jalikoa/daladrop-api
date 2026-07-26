import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { UpdateOrderStatusDto } from '../dto/orders.dto';
import { ModuleOrdersService } from '../use-cases/module-orders.service';

/**
 * Legacy `/v1/orders/:id` aliases expected by Uidocs 08 / OpenAPI prep.
 * Resolves module type from the order row, then reuses ModuleOrdersService.
 */
@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'orders', version: '1' })
export class LegacyOrdersController {
  public constructor(private readonly orders: ModuleOrdersService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get order by id (module-agnostic legacy alias)' })
  public get(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.getByIdAnyModule(id, principal);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update order status (customers: CANCELLED only)',
  })
  public patch(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatusAnyModule(id, principal, body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Alias for PATCH /orders/:id' })
  public patchStatus(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatusAnyModule(id, principal, body);
  }
}
