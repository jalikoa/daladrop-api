import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('audit_logs', { schema: 'audit' })
@Index(['user_id'])
@Index(['action'])
@Index(['created_at'])
@Index(['ip_address'])
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', nullable: true })
  @Index()
  user_id: number | null;

  @ManyToOne(() => User, { eager: false, nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  action: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  request_method: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  endpoint: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  @Column({ type: 'json', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  response_status: number | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  toJSON(): Record<string, unknown> {
    const { user, ...values } = { ...this };
    return values;
  }
}
