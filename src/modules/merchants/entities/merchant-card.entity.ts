import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { MerchantProfile } from './merchant-profile.entity';

@Entity('merchant_cards')
export class MerchantCard {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'merchant_id', type: 'bigint' })
  merchant_id: number;

  @Column({ name: 'qr_code_url', length: 500, nullable: true, default: null })
  qr_code_url: string | null;

  @Column({ name: 'pdf_url', length: 500, nullable: true, default: null })
  pdf_url: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => MerchantProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: MerchantProfile;
}