import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!EMAIL.test(normalized)) {
    throw new BadRequestException('Invalid email address');
  }
  return normalized;
}

export function normalizeKenyanPhone(value: string): string {
  const digits = value.replace(/[^\d+]/g, '');
  if (/^07\d{8}$/.test(digits) || /^01\d{8}$/.test(digits)) {
    return `254${digits.slice(1)}`;
  }
  if (/^\+254[17]\d{8}$/.test(digits)) return digits.slice(1);
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  throw new BadRequestException('Invalid Kenyan phone number');
}

export function normalizeIdentifier(value: string): {
  readonly value: string;
  readonly kind: 'email' | 'phone';
} {
  const trimmed = value.trim();
  if (trimmed.includes('@')) {
    return { value: normalizeEmail(trimmed), kind: 'email' };
  }
  return { value: normalizeKenyanPhone(trimmed), kind: 'phone' };
}

export function maskIdentifier(value: string, kind: 'email' | 'phone'): string {
  if (kind === 'phone') return `${value.slice(0, 5)}***${value.slice(-3)}`;
  const [local, domain = ''] = value.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

/**
 * Auth rate-limit / lockout key scoped to the subject identifier only.
 * Device fingerprints and client headers must never participate — attackers
 * can rotate them to bypass limits.
 */
export function subjectRateLimitKey(
  operation: string,
  identifier: string,
  _deviceFingerprint?: string,
): string {
  const digest = createHash('sha256').update(identifier).digest('hex');
  return `auth:${operation}:${digest}`;
}
