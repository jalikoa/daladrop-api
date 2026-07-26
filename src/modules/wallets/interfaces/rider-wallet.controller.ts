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

@ApiTags('Rider Finance')
@ApiBearerAuth()
@UseGuards(AuthTokenGuard)
@Controller({ path: 'rider/wallet', version: '1' })
export class RiderWalletController {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
    private readonly dashboard: FinanceDashboardService,
  ) {}

  @Get()
  public async getWallet(@CurrentAuth() principal: AuthPrincipalView) {
    const riderId = await this.resolveRiderId(principal.id);
    return this.wallets.getBalance(WalletOwnerType.RIDER, riderId);
  }

  @Get('dashboard')
  public async getDashboard(@CurrentAuth() principal: AuthPrincipalView) {
    const riderId = await this.resolveRiderId(principal.id);
    return this.dashboard.getDashboard(WalletOwnerType.RIDER, riderId);
  }

  @Get('transactions')
  public async listTransactions(
    @CurrentAuth() principal: AuthPrincipalView,
    @Query() query: ListWalletTxnsQueryDto,
  ) {
    const riderId = await this.resolveRiderId(principal.id);
    const wallet = await this.wallets.getOrCreate(WalletOwnerType.RIDER, riderId);
    return this.wallets.listTransactions(wallet.id, query);
  }

  @Get('statement/export')
  public async exportStatement(
    @CurrentAuth() principal: AuthPrincipalView,
    @Query() query: ExportWalletStatementQueryDto,
  ): Promise<StreamableFile> {
    const riderId = await this.resolveRiderId(principal.id);
    const result = await this.dashboard.exportStatement(
      WalletOwnerType.RIDER,
      riderId,
      query.format,
    );
    return new StreamableFile(result.buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  private async resolveRiderId(userId: string): Promise<string> {
    const rider = await this.prisma.rider.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!rider) {
      throw new NotFoundException('No rider linked to this account');
    }
    return rider.id;
  }
}
