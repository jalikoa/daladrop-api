export const IDENTITY_REPOSITORY = Symbol('IDENTITY_REPOSITORY');
export const AUTH_NOTIFICATION_QUEUE = 'auth-notifications';
export const AUTH_SOCIAL_VERIFIER = Symbol('AUTH_SOCIAL_VERIFIER');
export const HUMAN_CHALLENGE_VERIFIER = Symbol('HUMAN_CHALLENGE_VERIFIER');

export const AUTH_JOBS = {
  deliverOtp: 'auth.deliver-otp',
  recordAudit: 'auth.record-audit',
} as const;

export const AUTH_PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/google',
  '/auth/apple',
  '/auth/request-signup-otp',
  '/auth/verify-signup-otp',
  '/auth/resend-signup-otp',
  '/auth/forgot-password',
  '/auth/verify-reset-otp',
  '/auth/resend-reset-otp',
  '/auth/reset-password-confirmed',
  '/auth/register',
  '/auth/refresh',
  '/auth/mfa/verify-login',
] as const;
