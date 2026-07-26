import {
  BadRequestException,
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
  EscrowActionDto,
  ListEscrowQueryDto,
  ListWalletsQueryDto,
  ListWalletTxnsQueryDto,
  WalletAdjustDto,
  WalletAmountDto,
  WalletTransferDto,
} from '../dto/wallets.dto';
import { EscrowService } from '../use-cases/escrow.service';
import { WalletService } from '../use-cases/wallet.service';

function resolveIdempotencyKey(
  headerValue: string | undefined,
  bodyKey?: string,
): string | undefined {
  const fromHeader = headerValue?.trim();
  if (fromHeader) {
    return fromHeader;
  }
  const fromBody = bodyKey?.trim();
  return fromBody || undefined;
}

@ApiTags('Admin Wallets')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/wallets', version: '1' })
export class AdminWalletsController {
  public constructor(private readonly wallets: WalletService) {}

  @Get()
  @RequirePermission('read', 'wallets')
  public list(@Query() query: ListWalletsQueryDto) {
    return this.wallets.list(query);
  }

  @Post('transfer')
  @RequirePermission('manage', 'wallets')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  public transfer(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() body: WalletTransferDto,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    if (!body.fromWalletId || !body.toWalletId) {
      throw new BadRequestException('fromWalletId and toWalletId are required');
    }
    return this.wallets.transfer(
      body.fromWalletId,
      body.toWalletId,
      body.amount,
      {
        actorId: principal.id,
        reference: body.reference,
        description: body.description,
        idempotencyKey: resolveIdempotencyKey(
          idempotencyHeader,
          body.idempotencyKey,
        ),
      },
    );
  }

  @Get(':id')
  @RequirePermission('read', 'wallets')
  public get(@Param('id', ParseUUIDPipe) id: string) {
    return this.wallets.getById(id).then((wallet) => ({
      success: true as const,
      wallet,
    }));
  }

  @Get(':id/transactions')
  @RequirePermission('read', 'wallets')
  public listTxns(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListWalletTxnsQueryDto,
  ) {
    return this.wallets.listTransactions(id, query);
  }

  @Post(':id/credit')
  @RequirePermission('manage', 'wallets')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  public credit(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: WalletAmountDto,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    return this.wallets.credit(id, body.amount, {
      actorId: principal.id,
      paymentId: body.paymentId,
      journalEntryId: body.journalEntryId,
      reference: body.reference,
      description: body.description,
      idempotencyKey: resolveIdempotencyKey(
        idempotencyHeader,
        body.idempotencyKey,
      ),
    });
  }

  @Post(':id/debit')
  @RequirePermission('manage', 'wallets')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  public debit(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: WalletAmountDto,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    return this.wallets.debit(id, body.amount, {
      actorId: principal.id,
      paymentId: body.paymentId,
      journalEntryId: body.journalEntryId,
      reference: body.reference,
      description: body.description,
      idempotencyKey: resolveIdempotencyKey(
        idempotencyHeader,
        body.idempotencyKey,
      ),
    });
  }

  @Post(':id/hold')
  @RequirePermission('manage', 'wallets')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  public hold(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: WalletAmountDto,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    return this.wallets.hold(id, body.amount, {
      actorId: principal.id,
      paymentId: body.paymentId,
      journalEntryId: body.journalEntryId,
      reference: body.reference,
      description: body.description,
      idempotencyKey: resolveIdempotencyKey(
        idempotencyHeader,
        body.idempotencyKey,
      ),
    });
  }

  @Post(':id/release')
  @RequirePermission('manage', 'wallets')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  public release(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: WalletAmountDto,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    return this.wallets.release(id, body.amount, {
      actorId: principal.id,
      paymentId: body.paymentId,
      journalEntryId: body.journalEntryId,
      reference: body.reference,
      description: body.description,
      idempotencyKey: resolveIdempotencyKey(
        idempotencyHeader,
        body.idempotencyKey,
      ),
    });
  }

  @Post(':id/adjust')
  @RequirePermission('manage', 'wallets')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  public adjust(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: WalletAdjustDto,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    return this.wallets.adjust(id, body.amount, {
      actorId: principal.id,
      reason: body.reason,
      paymentId: body.paymentId,
      journalEntryId: body.journalEntryId,
      reference: body.reference,
      description: body.description ?? body.reason,
      idempotencyKey: resolveIdempotencyKey(
        idempotencyHeader,
        body.idempotencyKey,
      ),
    });
  }
}

@ApiTags('Admin Escrow')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard, AuthorizationGuard)
@Controller({ path: 'admin/escrow', version: '1' })
export class AdminEscrowController {
  public constructor(private readonly escrow: EscrowService) {}

  @Get()
  @RequirePermission('read', 'wallets')
  public list(@Query() query: ListEscrowQueryDto) {
    return this.escrow.list(query);
  }

  @Get(':id')
  @RequirePermission('read', 'wallets')
  public get(@Param('id', ParseUUIDPipe) id: string) {
    return this.escrow.getById(id);
  }

  @Post(':id/release')
  @RequirePermission('manage', 'wallets')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  public release(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EscrowActionDto,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    return this.escrow.release(id, {
      actorId: principal.id,
      reason: body.reason,
      idempotencyKey: resolveIdempotencyKey(
        idempotencyHeader,
        body.idempotencyKey,
      ),
    });
  }

  @Post(':id/forfeit')
  @RequirePermission('manage', 'wallets')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  public forfeit(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EscrowActionDto,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    return this.escrow.forfeit(id, {
      actorId: principal.id,
      reason: body.reason,
      idempotencyKey: resolveIdempotencyKey(
        idempotencyHeader,
        body.idempotencyKey,
      ),
    });
  }

  @Post(':id/refund')
  @RequirePermission('manage', 'wallets')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  public refund(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EscrowActionDto,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    return this.escrow.refund(id, {
      actorId: principal.id,
      reason: body.reason,
      idempotencyKey: resolveIdempotencyKey(
        idempotencyHeader,
        body.idempotencyKey,
      ),
    });
  }
}
