import {
  Controller,
  Get,
  NotFoundException,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WalletOwnerType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuthTokenGuard } from '../../identity/guards/auth-token.guard';
import { CurrentAuth } from '../../identity/decorators/current-auth.decorator';
import type { AuthPrincipalView } from '../../identity/domain/auth.contracts';
import {
  ExportWalletStatementQueryDto,
  ListWalletTxnsQueryDto,
} from '../dto/wallets.dto';
import { FinanceDashboardService } from '../use-cases/finance-dashboard.service';
import { WalletService } from '../use-cases/wallet.service';

@ApiTags('Merchant Finance')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'merchant/wallet', version: '1' })
export class MerchantWalletController {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
    private readonly dashboard: FinanceDashboardService,
  ) {}

  @Get()
  public async getWallet(@CurrentAuth() principal: AuthPrincipalView) {
    const merchantId = await this.resolveMerchantId(principal.id);
    return this.wallets.getBalance(WalletOwnerType.MERCHANT, merchantId);
  }

  @Get('dashboard')
  public async getDashboard(@CurrentAuth() principal: AuthPrincipalView) {
    const merchantId = await this.resolveMerchantId(principal.id);
    return this.dashboard.getDashboard(WalletOwnerType.MERCHANT, merchantId);
  }

  @Get('transactions')
  public async listTransactions(
    @CurrentAuth() principal: AuthPrincipalView,
    @Query() query: ListWalletTxnsQueryDto,
  ) {
    const merchantId = await this.resolveMerchantId(principal.id);
    const wallet = await this.wallets.getOrCreate(
      WalletOwnerType.MERCHANT,
      merchantId,
    );
    return this.wallets.listTransactions(wallet.id, query);
  }

  @Get('statement/export')
  public async exportStatement(
    @CurrentAuth() principal: AuthPrincipalView,
    @Query() query: ExportWalletStatementQueryDto,
  ): Promise<StreamableFile> {
    const merchantId = await this.resolveMerchantId(principal.id);
    const result = await this.dashboard.exportStatement(
      WalletOwnerType.MERCHANT,
      merchantId,
      query.format,
    );
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  private async resolveMerchantId(userId: string): Promise<string> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { ownerUserId: userId, deletedAt: null },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!merchant) {
      throw new NotFoundException('No merchant linked to this account');
    }
    return merchant.id;
  }
}
