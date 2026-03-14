import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type LedgerEntryType = 'debit' | 'credit';

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  transactionId: string;

  @Column()
  accountId: string;

  @Column({ type: 'enum', enum: ['debit', 'credit'] })
  type: LedgerEntryType;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: string;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;
}
