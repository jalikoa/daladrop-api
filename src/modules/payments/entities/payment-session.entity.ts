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
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentType } from '../enums/payment-type.enum';
import { MerchantProfile } from '../../merchants/entities/merchant-profile.entity';
import { v4 as uuidv4 } from 'uuid';

@Entity('payment_sessions', { schema: 'payments' })
@Index(['checkout_request_id'], { unique: true, where: 'checkout_request_id IS NOT NULL' })
@Index(['mpesa_receipt'], { unique: true, where: 'mpesa_receipt IS NOT NULL' })
@Index(['session_uuid'], { unique: true })
@Index(['merchant_id', 'status'])
@Index(['created_at'])
export class PaymentSession {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'char', length: 36, unique: true })
  session_uuid: string;

  @Column({ type: 'bigint' })
  @Index()
  merchant_id: number;

  @ManyToOne(() => MerchantProfile, { eager: false })
  @JoinColumn({ name: 'merchant_id' })
  merchant: MerchantProfile;

  @Column({ type: 'varchar', length: 20, nullable: true })
  customer_phone: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'KES' })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentType,
    default: PaymentType.NFC_TAP,
  })
  payment_type: PaymentType;

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  checkout_request_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  merchant_request_id: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, unique: true })
  mpesa_receipt: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  daraja_result_code: string | null;

  @Column({ type: 'text', nullable: true })
  daraja_result_desc: string | null;

  @Column({ type: 'text', nullable: true })
  failure_reason: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @BeforeInsert()
  generateUUID(): void {
    if (!this.session_uuid) {
      this.session_uuid = uuidv4();
    }
  }

  toJSON(): Record<string, unknown> {
    const { merchant, ...values } = { ...this };
    return values;
  }

  isCompleted(): boolean {
    return this.status === PaymentStatus.COMPLETED;
  }

  isPending(): boolean {
    return this.status === PaymentStatus.PENDING || this.status === PaymentStatus.INITIATED;
  }

  canTransitionTo(newStatus: PaymentStatus): boolean {
    const validTransitions: Record<PaymentStatus, PaymentStatus[]> = {
      [PaymentStatus.PENDING]: [PaymentStatus.INITIATED, PaymentStatus.CANCELLED, PaymentStatus.FAILED],
      [PaymentStatus.INITIATED]: [PaymentStatus.COMPLETED, PaymentStatus.FAILED, PaymentStatus.CANCELLED],
      [PaymentStatus.COMPLETED]: [PaymentStatus.REFUNDED],
      [PaymentStatus.FAILED]: [],
      [PaymentStatus.CANCELLED]: [],
      [PaymentStatus.REFUNDED]: [],
    };

    return validTransitions[this.status]?.includes(newStatus) ?? false;
  }
}
