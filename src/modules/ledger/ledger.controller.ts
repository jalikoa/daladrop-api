import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  DefaultValuePipe,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerRepository } from './repositories/ledger.repository';
import { LedgerEntryType } from './entities/ledger-entry.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('ledger')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class LedgerController {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly ledgerRepo: LedgerRepository,
  ) {}

  /**
   * GET /ledger/accounts/:id/balance
   * Returns the current running balance for a ledger account.
   * Returns "0.00" when the account has no entries yet.
   */
  @Get('accounts/:id/balance')
  async getBalance(
    @Param('id', ParseIntPipe) accountId: number,
  ): Promise<{ account_id: number; balance: string }> {
    const balance = await this.ledgerService.getBalance(accountId);
    return { account_id: accountId, balance };
  }

  /**
   * POST /ledger/entries
   * Records a balanced double-entry set of ledger entries within a single
   * database transaction. The sum of all debits must equal the sum of all
   * credits — returns 422 if they don't balance.
   */
  @Post('entries')
  @HttpCode(HttpStatus.CREATED)
  async recordEntries(
    @Body()
    body: {
      transaction_id: string;
      entries: Array<{
        accountId: number;
        type: LedgerEntryType;    // 'DEBIT' | 'CREDIT'
        amount: string;
        metadata?: Record<string, unknown>;
      }>;
    },
  ) {
    if (!body.transaction_id || !body.entries?.length) {
      throw new BadRequestException('transaction_id and entries are required');
    }
    const entries = await this.ledgerService.record(body.transaction_id, body.entries);
    return { success: true, count: entries.length, entries };
  }

  /**
   * GET /ledger/entries?account_id=...
   * Paginated list of ledger entries for a specific account, ordered by
   * most recent first. Use limit/offset for pagination.
   */
  @Get('entries')
  async getEntries(
    @Query('account_id', ParseIntPipe) accountId: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    const entries = await this.ledgerRepo.findEntriesByAccount(accountId, limit, offset);
    return { account_id: accountId, count: entries.length, data: entries };
  }
}