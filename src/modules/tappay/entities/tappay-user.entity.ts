import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToOne,
  Generated,
  Index,
} from 'typeorm';
import { TappayWallet } from './tappay-wallet.entity';


@Entity('tappay_users')
export class TappayUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  email: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  password_hash: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  @Index()
  phone: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'avatar_url' })
  avatar_url: string;

  @Column({ type: 'varchar', length: 2, nullable: true, name: 'avatar_initial' })
  avatar_initial: string;

  @Column({ type: 'boolean', default: false, name: 'is_verified' })
  is_verified: boolean;

  @Column({ type: 'boolean', default: false, name: 'biometric_enabled' })
  biometric_enabled: boolean;

  @Column({ type: 'boolean', default: false, name: 'two_fa_enabled' })
  two_fa_enabled: boolean;

  @Column({ type: 'boolean', default: false, name: 'screenshot_disabled' })
  screenshot_disabled: boolean;

  @Column({ type: 'boolean', default: true, name: 'login_notifications' })
  login_notifications: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamp with time zone', name: 'deleted_at' })
  deleted_at: Date;

  @OneToOne(() => TappayWallet, (wallet) => wallet.user, { cascade: true })
  wallet: TappayWallet;

  toJSON(): any {
    const { password_hash, deleted_at, ...rest } = this;
    return {
      ...rest,
      isVerified: this.is_verified,
      biometricEnabled: this.biometric_enabled,
      twoFAEnabled: this.two_fa_enabled,
      screenshotDisabled: this.screenshot_disabled,
      loginNotifications: this.login_notifications,
    };
  }
}
