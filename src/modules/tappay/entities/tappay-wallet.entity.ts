import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Generated,
} from 'typeorm';
import { TappayUser } from './tappay-user.entity';

@Entity('tappay_wallets')
export class TappayWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  user_id: string;

  @OneToOne(() => TappayUser, (user) => user.wallet)
  @JoinColumn({ name: 'user_id' })
  user: TappayUser;

  @Column({ type: 'varchar', length: 50, name: 'wallet_number' })
  wallet_number: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'varchar', length: 3, default: 'KES' })
  currency: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'pin_hash' })
  pin_hash: string;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updated_at: Date;

  toJSON(): any {
    const { user_id, ...rest } = this;
    return {
      ...rest,
    };
  }
}
