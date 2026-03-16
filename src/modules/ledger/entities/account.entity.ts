import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('ledger_accounts')
export class Account {
  @PrimaryGeneratedColumn({ type: 'bigint' })   // ← bigint AUTO_INCREMENT, not uuid
  id: number;

  @Column({ name: 'code', length: 20, unique: true })
  code: string;

  @Column({ name: 'name', length: 255 })
  name: string;

  @Column({
    name: 'account_type',
    type: 'enum',
    enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
  })
  accountType: string;

  @Column({ name: 'currency', length: 3, default: 'KES' })
  currency: string;

  @Column({ name: 'balance', type: 'decimal', precision: 18, scale: 2, default: 0 })
  balance: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}