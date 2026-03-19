import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { MerchantProfile } from '../../merchants/entities/merchant-profile.entity';

@Entity('nfc_tags', { schema: 'merchant' })
@Index(['merchant_id'])
@Index(['tag_uid'], { unique: true, where: 'tag_uid IS NOT NULL' })
export class NfcTag {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', nullable: true })
  @Index()
  merchant_id: number | null;

  @ManyToOne(() => MerchantProfile, { eager: false, nullable: true })
  @JoinColumn({ name: 'merchant_id' })
  merchant: MerchantProfile | null;

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  tag_uid: string | null;

  @Column({ type: 'text' })
  encrypted_payload: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @BeforeInsert()
  normalizeTagUid(): void {
    if (this.tag_uid) {
      this.tag_uid = this.tag_uid.trim().toUpperCase();
    }
  }

  toJSON(): Record<string, unknown> {
    const { merchant, ...values } = { ...this };
    return values;
  }
}
