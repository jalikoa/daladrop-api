import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WalletOwnerType } from '@prisma/client';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import { ListWalletTxnsQueryDto } from '../dto/wallets.dto';
import { WalletService } from '../use-cases/wallet.service';

/**
 * Thin customer wallet read APIs for future/profile use.
 * Does not change checkout/pay contracts — customer app has no wallet UI.
 */
@ApiTags('Customer Wallets')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'customer', version: '1' })
export class CustomerWalletController {
  public constructor(private readonly wallets: WalletService) {}

  @Get(':uid/wallet')
  public async getWallet(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('uid', ParseUUIDPipe) uid: string,
  ) {
    this.assertSelf(principal.id, uid);
    return this.wallets.getBalance(WalletOwnerType.CUSTOMER, uid);
  }

  @Get(':uid/wallet/transactions')
  public async listTransactions(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('uid', ParseUUIDPipe) uid: string,
    @Query() query: ListWalletTxnsQueryDto,
  ) {
    this.assertSelf(principal.id, uid);
    const wallet = await this.wallets.getOrCreate(WalletOwnerType.CUSTOMER, uid);
    return this.wallets.listTransactions(wallet.id, query);
  }

  private assertSelf(actorId: string, uid: string): void {
    if (actorId !== uid) {
      throw new ForbiddenException('Cannot access another customer wallet');
    }
  }
}
