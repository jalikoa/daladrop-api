import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { MerchantStatus, MerchantVerificationStatus } from '../enums/merchant-status.enum';
import { User } from '../../users/entities/user.entity';

@Entity('merchant_profiles')
@Index(['user_id'], { unique: true })
@Index(['business_name'])
@Index(['uid'], { unique: true })
export class MerchantProfile {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({
    type: 'char',
    length: 36,
    unique: true,
    default: () => 'UUID()',
  })
  uid: string;

  @Column({ type: 'bigint', unique: true })
  @Index()
  user_id: number;

  @OneToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 255 })
  business_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  business_email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  business_phone: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo_url: string | null;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  paybill_number: string;

  @Column({ type: 'varchar', length: 20 })
  account_number: string;

  @Column({
    type: 'enum',
    enum: MerchantStatus,
    default: MerchantStatus.PENDING,
  })
  status: MerchantStatus;

  @Column({
    type: 'enum',
    enum: MerchantVerificationStatus,
    default: MerchantVerificationStatus.UNVERIFIED,
  })
  verification_status: MerchantVerificationStatus;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeData(): void {
    if (this.business_name) {
      this.business_name = this.business_name.trim();
    }
    if (this.paybill_number) {
      this.paybill_number = this.paybill_number.replace(/\s/g, '');
    }
    if (this.account_number) {
      this.account_number = this.account_number.replace(/\s/g, '');
    }
  }

  toJSON(): Record<string, unknown> {
    const { user, ...values } = { ...this };
    return values;
  }

  isActive(): boolean {
    return this.status === MerchantStatus.ACTIVE &&
      this.verification_status === MerchantVerificationStatus.VERIFIED;
  }
}
