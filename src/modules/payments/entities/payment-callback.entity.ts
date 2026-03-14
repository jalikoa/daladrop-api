import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('payment_callbacks', { schema: 'payments' })
@Index(['checkout_request_id'])
@Index(['mpesa_receipt_number'])
@Index(['created_at'])
export class PaymentCallback {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  checkout_request_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  mpesa_receipt_number: string | null;

  @Column({ type: 'int', nullable: true })
  result_code: number | null;

  @Column({ type: 'text', nullable: true })
  result_desc: string | null;

  @Column({ type: 'json' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      checkout_request_id: this.checkout_request_id,
      mpesa_receipt_number: this.mpesa_receipt_number,
      result_code: this.result_code,
      created_at: this.created_at,
    };
  }
}
