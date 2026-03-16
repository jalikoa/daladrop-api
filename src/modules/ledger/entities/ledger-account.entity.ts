import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('ledger_accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'balance', type: 'decimal', precision: 18, scale: 2, default: 0 })
  balance: string;

  @CreateDateColumn({ name: 'created_at' })   // ← tells TypeORM the DB column is created_at
  createdAt: Date;
}