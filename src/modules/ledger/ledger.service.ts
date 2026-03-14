import { Injectable } from '@nestjs/common';
import { LedgerRepository } from './repositories/ledger.repository';

@Injectable()
export class LedgerService {
  constructor(private readonly ledgerRepo: LedgerRepository) {}

  async record(transactionId: string, entries: Array<{ accountId: string; type: 'debit' | 'credit'; amount: string; metadata?: any }>) {
    return this.ledgerRepo.recordEntries(transactionId, entries);
  }

  async getBalance(accountId: string) {
    return this.ledgerRepo.getAccountBalance(accountId);
  }
}
