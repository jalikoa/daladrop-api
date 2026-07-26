import type {
  AuthOtpChannel,
  AuthOtpPurpose,
} from '../../identity/domain/auth.contracts';

export interface DeliverOtpJob {
  readonly kind: 'deliver-otp';
  readonly challengeId: string;
  readonly identifier: string;
  readonly channel: AuthOtpChannel;
  readonly purpose: AuthOtpPurpose;
  readonly code: string;
}

export interface RecordAuthAuditJob {
  readonly kind: 'record-auth-audit';
  readonly userId?: string;
  readonly identifier: string;
  readonly success: boolean;
  readonly failureReason?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly deviceFingerprint?: string;
  readonly correlationId?: string;
}

export type AuthBackgroundJob = DeliverOtpJob | RecordAuthAuditJob;
