import { Injectable } from '@nestjs/common';
import { LedgerRepository } from '../repositories/ledger.repository';

@Injectable()
export class GetAccountBalanceUseCase {
  constructor(private readonly ledgerRepo: LedgerRepository) {}

  async execute(accountId: string) {
    return this.ledgerRepo.getAccountBalance(accountId);
  }
}
