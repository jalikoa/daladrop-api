import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Account } from '../entities/account.entity';
import { LedgerEntry, LedgerEntryType } from '../entities/ledger-entry.entity';

@Injectable()
export class LedgerRepository {
  private readonly logger = new Logger(LedgerRepository.name);

  constructor(
    @InjectRepository(Account)
    private accountsRepo: Repository<Account>,
    @InjectRepository(LedgerEntry)
    private entriesRepo: Repository<LedgerEntry>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ── Look up by numeric PK ─────────────────────────────────────────────────
  async getAccountById(accountId: number): Promise<Account | null> {
    return this.accountsRepo.findOne({ where: { id: accountId } });
  }

  // ── Look up by name (used by PaymentListener since there is no `code` column) ──
  async getAccountByName(name: string): Promise<Account | null> {
    return this.accountsRepo.findOne({ where: { name } });
  }

  async getAccountBalance(accountId: number): Promise<string> {
    const account = await this.getAccountById(accountId);
    return account ? account.balance : '0.00';
  }

  async recordEntries(
    transactionId: string,
    entries: Array<{
      accountId: number;          // ← number, not string
      type: LedgerEntryType;      // 'DEBIT' | 'CREDIT'  (uppercase)
      amount: string;
      metadata?: any;
    }>,
  ): Promise<LedgerEntry[]> {
    // Validate balanced books before touching the DB
    const totalDebit  = entries.filter(e => e.type === 'DEBIT').reduce((s, e) => s + parseFloat(e.amount), 0);
    const totalCredit = entries.filter(e => e.type === 'CREDIT').reduce((s, e) => s + parseFloat(e.amount), 0);

    if (Math.abs(totalDebit - totalCredit) > 1e-6) {
      throw new UnprocessableEntityException(
        `Ledger entries are unbalanced: total debits ${totalDebit.toFixed(2)} ≠ total credits ${totalCredit.toFixed(2)}`,
      );
    }

    return this.dataSource.transaction(async manager => {
      const savedEntries: LedgerEntry[] = [];

      for (const e of entries) {
        // create() with a single object returns a single LedgerEntry
        const entry = manager.create(LedgerEntry, {
          transactionId,
          accountId: e.accountId,   // number
          type:      e.type,
          amount:    e.amount,
          metadata:  e.metadata ?? null,
        });

        const saved = await manager.save(LedgerEntry, entry);
        savedEntries.push(saved);

        // Update running balance on the account
        const account = await manager.findOne(Account, { where: { id: e.accountId } });
        if (account) {
          const current  = parseFloat(account.balance || '0');
          const delta    = parseFloat(e.amount);
          const newBal   = e.type === 'DEBIT' ? current - delta : current + delta;
          account.balance = newBal.toFixed(2);
          await manager.save(Account, account);
        }
      }

      this.logger.debug(`Recorded ${savedEntries.length} ledger entries for tx ${transactionId}`);
      return savedEntries;
    });
  }

  async findEntriesByAccount(
    accountId: number,    // ← number, not string
    limit = 50,
    offset = 0,
  ): Promise<LedgerEntry[]> {
    return this.entriesRepo.find({
      where:  { accountId },
      order:  { createdAt: 'DESC' },
      take:   limit,
      skip:   offset,
    });
  }
}