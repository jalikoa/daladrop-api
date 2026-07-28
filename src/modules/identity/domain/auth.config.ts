import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function positiveInt(value: string | number | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
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
    return this.int('auth.accessTtlSeconds', 'AUTH_ACCESS_TTL_SECONDS', 15 * 60);
  }

  public get refreshTtlSeconds(): number {
    return this.int(
      'auth.refreshTtlSeconds',
      'AUTH_REFRESH_TTL_SECONDS',
      30 * 24 * 60 * 60,
    );
  }

  /** Hard session lifetime — never extended by refresh rotation. Default 90 days. */
  public get sessionAbsoluteTtlSeconds(): number {
    return this.int(
      'auth.sessionAbsoluteTtlSeconds',
      'AUTH_SESSION_ABSOLUTE_TTL_SECONDS',
      90 * 24 * 60 * 60,
    );
  }

  public get otpTtlSeconds(): number {
    return this.int('auth.otpTtlSeconds', 'AUTH_OTP_TTL_SECONDS', 5 * 60);
  }

  public get otpResendCooldownSeconds(): number {
    return this.int(
      'auth.otpResendCooldownSeconds',
      'AUTH_OTP_RESEND_COOLDOWN_SECONDS',
      60,
    );
  }

  public get otpMaxAttempts(): number {
    return this.int('auth.otpMaxAttempts', 'AUTH_OTP_MAX_ATTEMPTS', 5);
  }

  public get otpSendsPerWindow(): number {
    return this.int('auth.otpSendsPerWindow', 'AUTH_OTP_SENDS_PER_WINDOW', 5);
  }

  public get otpSendWindowSeconds(): number {
    return this.int(
      'auth.otpSendWindowSeconds',
      'AUTH_OTP_SEND_WINDOW_SECONDS',
      15 * 60,
    );
  }

  public get loginAttemptsPerWindow(): number {
    return this.int(
      'auth.loginAttemptsPerWindow',
      'AUTH_LOGIN_ATTEMPTS_PER_WINDOW',
      10,
    );
  }

  public get loginWindowSeconds(): number {
    return this.int('auth.loginWindowSeconds', 'AUTH_LOGIN_WINDOW_SECONDS', 15 * 60);
  }

  public get humanChallengeRequired(): boolean {
    return this.bool(
      'auth.humanChallengeRequired',
      'AUTH_HUMAN_CHALLENGE_REQUIRED',
      false,
    );
  }

  public get emailProvider(): string {
    return (
      this.config.get<string>('auth.emailProvider') ??
      process.env.AUTH_EMAIL_PROVIDER ??
      'smtp'
    );
  }

  public get smsProvider(): string {
    return (
      this.config.get<string>('auth.smsProvider') ??
      process.env.AUTH_SMS_PROVIDER ??
      'http-sms'
    );
  }

  public get emailFrom(): string {
    return (
      this.config.get<string>('email.from') ??
      process.env.SMTP_FROM ??
      'noreply@daladrop.local'
    );
  }

  public get totpIssuer(): string {
    return (
      this.config.get<string>('auth.totpIssuer') ??
      process.env.AUTH_TOTP_ISSUER ??
      'DalaDrop'
    );
  }

  public get otpConsoleLog(): boolean {
    return this.bool('auth.otpConsoleLog', 'AUTH_OTP_CONSOLE_LOG', false);
  }

  public get otpForceSend(): boolean {
    return this.bool('auth.otpForceSend', 'AUTH_OTP_FORCE_SEND', false);
  }

  public get otpSkipSend(): boolean {
    return this.bool('auth.otpSkipSend', 'AUTH_OTP_SKIP_SEND', false);
  }

  private int(path: string, envKey: string, fallback: number): number {
    return positiveInt(
      this.config.get<number | string>(path) ?? process.env[envKey],
      fallback,
    );
  }

  private bool(path: string, envKey: string, fallback: boolean): boolean {
    const fromConfig = this.config.get<boolean | string>(path);
    if (typeof fromConfig === 'boolean') return fromConfig;
    if (typeof fromConfig === 'string' && fromConfig.length > 0) {
      return fromConfig === 'true';
    }
    const fromEnv = process.env[envKey];
    if (fromEnv === undefined || fromEnv === '') return fallback;
    return fromEnv === 'true';
  }
}
