import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Account } from '../entities/account.entity';
import { LedgerEntry } from '../entities/ledger-entry.entity';

@Injectable()
export class LedgerRepository {
  private readonly logger = new Logger(LedgerRepository.name);

  constructor(
    @InjectRepository(Account, 'ledger') private accountsRepo: Repository<Account>,
    @InjectRepository(LedgerEntry, 'ledger') private entriesRepo: Repository<LedgerEntry>,
    @InjectDataSource('ledger') private readonly dataSource: DataSource,
  ) {}

  async getAccountById(accountId: string) {
    return this.accountsRepo.findOne({ where: { id: accountId } });
  }

  async getAccountBalance(accountId: string) {
    const account = await this.getAccountById(accountId);
    return account ? account.balance : '0.00';
  }

  async recordEntries(transactionId: string, entries: Array<{ accountId: string; type: 'debit' | 'credit'; amount: string; metadata?: any }>) {
    // Ensure debits === credits
    const totalDebit = entries.filter(e => e.type === 'debit').reduce((s, e) => s + parseFloat(e.amount), 0);
    const totalCredit = entries.filter(e => e.type === 'credit').reduce((s, e) => s + parseFloat(e.amount), 0);
    if (Math.abs(totalDebit - totalCredit) > 1e-6) {
      throw new Error('Debits and credits must balance');
    }

    return this.entriesRepo.manager.transaction(async manager => {
      const savedEntries: LedgerEntry[] = [];

      for (const e of entries) {
        const entry = this.entriesRepo.create({ transactionId, accountId: e.accountId, type: e.type, amount: e.amount, metadata: e.metadata || null });
        const saved = await manager.save(entry);
        savedEntries.push(saved);

        // update account balance
        let account = await manager.findOne(Account, { where: { id: e.accountId } });
        if (!account) {
          account = this.accountsRepo.create({ id: e.accountId, name: e.accountId, balance: '0.00' });
        }
        const current = parseFloat(account.balance || '0');
        const delta = parseFloat(e.amount);
        const newBalance = e.type === 'debit' ? current - delta : current + delta;
        account.balance = newBalance.toFixed(2);
        await manager.save(account);
      }

      this.logger.debug(`Recorded ${savedEntries.length} ledger entries for tx ${transactionId}`);
      return savedEntries;
    });
  }

  async findEntriesByAccount(accountId: string, limit = 50, offset = 0) {
    return this.entriesRepo.find({ where: { accountId }, order: { createdAt: 'DESC' }, take: limit, skip: offset });
  }
}
