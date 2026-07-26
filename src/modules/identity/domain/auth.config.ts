import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

@Injectable()
export class AuthConfig {
  public constructor(private readonly config: ConfigService) {}

  public get jwtSecret(): string {
    return (
      this.config.get<string>('jwt.secret') ?? process.env.JWT_SECRET ?? ''
    );
  }

  public get accessTtlSeconds(): number {
    return positiveInt(process.env.AUTH_ACCESS_TTL_SECONDS, 15 * 60);
  }

  public get refreshTtlSeconds(): number {
    return positiveInt(process.env.AUTH_REFRESH_TTL_SECONDS, 30 * 24 * 60 * 60);
  }

  /** Hard session lifetime — never extended by refresh rotation. Default 90 days. */
  public get sessionAbsoluteTtlSeconds(): number {
    return positiveInt(
      process.env.AUTH_SESSION_ABSOLUTE_TTL_SECONDS,
      90 * 24 * 60 * 60,
    );
  }

  public get otpTtlSeconds(): number {
    return positiveInt(process.env.AUTH_OTP_TTL_SECONDS, 5 * 60);
  }

  public get otpResendCooldownSeconds(): number {
    return positiveInt(process.env.AUTH_OTP_RESEND_COOLDOWN_SECONDS, 60);
  }

  public get otpMaxAttempts(): number {
    return positiveInt(process.env.AUTH_OTP_MAX_ATTEMPTS, 5);
  }

  public get otpSendsPerWindow(): number {
    return positiveInt(process.env.AUTH_OTP_SENDS_PER_WINDOW, 5);
  }

  public get otpSendWindowSeconds(): number {
    return positiveInt(process.env.AUTH_OTP_SEND_WINDOW_SECONDS, 15 * 60);
  }

  public get loginAttemptsPerWindow(): number {
    return positiveInt(process.env.AUTH_LOGIN_ATTEMPTS_PER_WINDOW, 10);
  }

  public get loginWindowSeconds(): number {
    return positiveInt(process.env.AUTH_LOGIN_WINDOW_SECONDS, 15 * 60);
  }

  public get humanChallengeRequired(): boolean {
    return process.env.AUTH_HUMAN_CHALLENGE_REQUIRED === 'true';
  }

  public get emailProvider(): string {
    return process.env.AUTH_EMAIL_PROVIDER ?? 'smtp';
  }

  public get smsProvider(): string {
    return process.env.AUTH_SMS_PROVIDER ?? 'http-sms';
  }

  public get emailFrom(): string {
    return (
      this.config.get<string>('email.from') ??
      process.env.SMTP_FROM ??
      'noreply@daladrop.local'
    );
  }

  public get totpIssuer(): string {
    return process.env.AUTH_TOTP_ISSUER ?? 'DalaDrop';
  }
}
