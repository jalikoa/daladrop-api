import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { AuthorizationGuard } from '../../authorization/guards/authorization.guard';
import { RequirePermission } from '../../authorization/decorators/require-permission.decorator';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import {
  CreateSettlementBatchDto,
  ListSettlementBatchesQueryDto,
  ProcessSettlementBatchDto,
} from '../dto/settlements.dto';
import { SettlementService } from '../use-cases/settlement.service';

function resolveIdempotencyKey(
  headerValue: string | undefined,
  bodyKey?: string,
): string | undefined {
  const fromHeader = headerValue?.trim();
  if (fromHeader) return fromHeader;
  const fromBody = bodyKey?.trim();
  return fromBody || undefined;
}

@ApiTags('Admin Settlements')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/settlements', version: '1' })
export class AdminSettlementsController {
  public constructor(private readonly settlements: SettlementService) {}

  @Get('policies')
  @RequirePermission('read', 'settlements')
  public listPolicies() {
    return this.settlements.listPolicies();
  }

  @Get('policies/:id')
  @RequirePermission('read', 'settlements')
  public getPolicy(@Param('id', ParseUUIDPipe) id: string) {
    return this.settlements.getPolicy(id);
  }

  @Post('batches')
  @RequirePermission('manage', 'settlements')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  public createBatch(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: CreateSettlementBatchDto,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    return this.settlements.createBatchFromPolicy(body.policyId, {
      actorId: principal.id,
      idempotencyKey: resolveIdempotencyKey(idempotencyHeader, body.idempotencyKey),
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
      force: body.force,
    });
  }

  @Get('batches')
  @RequirePermission('read', 'settlements')
  public listBatches(@Query() query: ListSettlementBatchesQueryDto) {
    return this.settlements.listBatches(query);
  }

  @Get('batches/:id')
  @RequirePermission('read', 'settlements')
  public getBatch(@Param('id', ParseUUIDPipe) id: string) {
    return this.settlements.getBatch(id);
  }

  @Post('batches/:id/approve')
  @RequirePermission('manage', 'settlements')
  public approveBatch(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.settlements.approveBatch(id, principal.id);
  }

  @Post('batches/:id/process')
  @RequirePermission('manage', 'settlements')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  public processBatch(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ProcessSettlementBatchDto,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    return this.settlements.processBatch(
      id,
      principal.id,
      resolveIdempotencyKey(idempotencyHeader, body?.idempotencyKey),
    );
  }

  @Post('batches/:id/cancel')
  @RequirePermission('manage', 'settlements')
  public cancelBatch(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.settlements.cancelBatch(id, principal.id);
  }
}
