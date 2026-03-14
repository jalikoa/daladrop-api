import { Injectable } from '@nestjs/common';
import { LedgerRepository } from '../repositories/ledger.repository';

@Injectable()
export class RecordTransactionUseCase {
  constructor(private readonly ledgerRepo: LedgerRepository) {}

  async execute(transactionId: string, entries: Array<{ accountId: string; type: 'debit' | 'credit'; amount: string; metadata?: any }>) {
    return this.ledgerRepo.recordEntries(transactionId, entries);
  }
}
