import { Injectable } from '@nestjs/common';
import { LedgerRepository } from './repositories/ledger.repository';
import { LedgerEntryType } from './entities/ledger-entry.entity';

@Injectable()
export class LedgerService {
  constructor(private readonly ledgerRepo: LedgerRepository) {}

  async record(
    transactionId: string,
    entries: Array<{
      accountId: number;
      type: LedgerEntryType;    // 'DEBIT' | 'CREDIT'
      amount: string;
      metadata?: any;
    }>,
  ) {
    return this.ledgerRepo.recordEntries(transactionId, entries);
  }

  async getBalance(accountId: number): Promise<string> {
    return this.ledgerRepo.getAccountBalance(accountId);
  }
}