export type AuthOtpPurpose =
  'SIGNUP' | 'LOGIN' | 'RESET_PASSWORD' | 'VERIFY_PHONE' | 'VERIFY_EMAIL';

export type AuthOtpChannel = 'EMAIL' | 'SMS';
export type AuthMfaMethod = 'TOTP' | 'EMAIL' | 'SMS';

export interface AuthUserView {
  readonly id: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly surname: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly profilePhoto: string | null;
}

export interface AuthSessionView {
  readonly success: true;
  readonly token: string;
  readonly refreshToken: string;
  readonly sessionId: string;
  readonly expiresAt: string;
  readonly user: AuthUserView;
  readonly isNewUser?: boolean;
}

export interface MfaRequiredView {
  readonly success: true;
  readonly mfaRequired: true;
  readonly mfaChallengeId: string;
  readonly method: AuthMfaMethod;
  readonly masked?: string;
}

export interface AuthPrincipalView {
  readonly id: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly sessionId: string;
}

export interface AuthRequestContext {
  readonly deviceId: string;
  readonly deviceFingerprint: string;
  readonly userAgent?: string;
  readonly ipAddress?: string;
  readonly correlationId?: string;
}
