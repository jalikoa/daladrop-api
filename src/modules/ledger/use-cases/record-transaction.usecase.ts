import { Injectable } from '@nestjs/common';
import { LedgerRepository } from '../repositories/ledger.repository';
import { LedgerEntryType } from '../entities/ledger-entry.entity';

@Injectable()
export class RecordTransactionUseCase {
  constructor(private readonly ledgerRepo: LedgerRepository) {}

  async execute(
    transactionId: string,
    entries: Array<{
      accountId: number;
      type: LedgerEntryType;
      amount: string;
      metadata?: any;
    }>,
  ) {
    return this.ledgerRepo.recordEntries(transactionId, entries);
  }
}