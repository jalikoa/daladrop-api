import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

// DB stores DEBIT/CREDIT uppercase — entity enum must match
export type LedgerEntryType = 'DEBIT' | 'CREDIT';

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn({ type: 'bigint' })   // ← bigint AUTO_INCREMENT, not uuid
  id: number;

  @Column({ name: 'transaction_ref', length: 100 })
  transactionId: string;

  @Column({ name: 'account_id', type: 'bigint' })
  accountId: number;                              // ← number, not string (FK to bigint PK)

  @Column({
    name: 'entry_type',
    type: 'enum',
    enum: ['DEBIT', 'CREDIT'],                   // ← uppercase to match DB enum
  })
  type: LedgerEntryType;

  @Column({ name: 'amount', type: 'decimal', precision: 18, scale: 2 })
  amount: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}