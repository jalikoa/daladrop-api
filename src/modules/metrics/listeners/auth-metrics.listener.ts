import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MetricsService } from '../../metrics/metrics.service';
import { AppLogger } from '../../logger/logger.service';

export const AUTH_EVENTS = {
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILURE: 'auth.login.failure',
} as const;

/**
 * AuthMetricsListener
 *
 * Wire up: emit AUTH_EVENTS.LOGIN_SUCCESS / LOGIN_FAILURE from AuthService.login()
 * after this listener is added to AuthModule.providers[].
 *
 * In AuthService.login():
 *   this.eventEmitter.emit(AUTH_EVENTS.LOGIN_SUCCESS, { userId: user.id });
 *   // or on failure:
 *   this.eventEmitter.emit(AUTH_EVENTS.LOGIN_FAILURE, { email });
 */
@Injectable()
export class AuthMetricsListener {
  constructor(
    private readonly metrics: MetricsService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(AuthMetricsListener.name);
  }

  @OnEvent(AUTH_EVENTS.LOGIN_SUCCESS)
  handleLoginSuccess(payload: { userId: number; email?: string }) {
    this.metrics.recordAuthAttempt('success');
    this.logger.log('Login success', { type: 'auth_login', result: 'success', userId: payload.userId });
  }

  @OnEvent(AUTH_EVENTS.LOGIN_FAILURE)
  handleLoginFailure(payload: { email?: string; reason?: string }) {
    this.metrics.recordAuthAttempt('failure');
    this.logger.warn('Login failure', { type: 'auth_login', result: 'failure', reason: payload.reason });
  }
}