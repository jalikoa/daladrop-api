import type { Queue, Job } from 'bullmq';
import { AuthJobDispatcher } from '../use-cases/auth-job.dispatcher';
import { AuthNotificationProcessor } from '../processors/auth-notification.processor';
import { EmailService } from '../../../platform/messaging/email/email.service';
import { SmsService } from '../../../platform/messaging/sms/sms.service';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import type { AuthConfig } from '../../identity/domain/auth.config';
import type { AuthBackgroundJob } from '../domain/auth-job.types';

describe('auth background jobs', () => {
  it('dispatches durable retryable jobs and requires an assigned id', async () => {
    const queue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    } as unknown as Queue<AuthBackgroundJob>;
    const dispatcher = new AuthJobDispatcher(queue);
    const payload = {
      kind: 'record-auth-audit',
      identifier: 'user@example.com',
      success: true,
    } as const;
    await expect(dispatcher.dispatch(payload)).resolves.toBe('job-1');
    expect(queue.add).toHaveBeenCalledWith(
      payload.kind,
      payload,
      expect.objectContaining({
        attempts: 5,
        backoff: { type: 'exponential', delay: 1_000 },
      }),
    );
    (queue.add as jest.Mock).mockResolvedValueOnce({ id: undefined });
    await expect(dispatcher.dispatch(payload)).rejects.toThrow(
      'Queue did not assign a job id',
    );
  });

  it('delivers email and SMS OTPs then marks challenge sent', async () => {
    const email = { send: jest.fn() } as unknown as EmailService;
    const sms = { send: jest.fn() } as unknown as SmsService;
    const prisma = {
      otpChallenge: { updateMany: jest.fn() },
      loginAttempt: { create: jest.fn() },
    } as unknown as PrismaService;
    const config = {
      emailProvider: 'smtp',
      emailFrom: 'auth@daladrop.test',
      smsProvider: 'sms',
    } as AuthConfig;
    const processor = new AuthNotificationProcessor(email, sms, prisma, config);
    const emailJob = {
      data: {
        kind: 'deliver-otp',
        challengeId: 'challenge',
        identifier: 'user@example.com',
        channel: 'EMAIL',
        purpose: 'RESET_PASSWORD',
        code: '123456',
      },
    } as Job<AuthBackgroundJob>;
    await processor.process(emailJob);
    expect(email.send).toHaveBeenCalledWith(
      'smtp',
      expect.objectContaining({
        to: ['user@example.com'],
        subject: 'DalaDrop reset password code',
      }),
    );
    expect(prisma.otpChallenge.updateMany).toHaveBeenCalled();

    const smsJob = {
      data: {
        ...emailJob.data,
        identifier: '254712345678',
        channel: 'SMS',
        purpose: 'LOGIN',
      },
    } as Job<AuthBackgroundJob>;
    await processor.process(smsJob);
    expect(sms.send).toHaveBeenCalledWith(
      'sms',
      expect.objectContaining({ to: '254712345678' }),
    );
  });

  it('persists asynchronous login audit jobs', async () => {
    const email = { send: jest.fn() } as unknown as EmailService;
    const sms = { send: jest.fn() } as unknown as SmsService;
    const prisma = {
      otpChallenge: { updateMany: jest.fn() },
      loginAttempt: { create: jest.fn() },
    } as unknown as PrismaService;
    const processor = new AuthNotificationProcessor(
      email,
      sms,
      prisma,
      {} as AuthConfig,
    );
    await processor.process({
      data: {
        kind: 'record-auth-audit',
        userId: 'user',
        identifier: 'user@example.com',
        success: false,
        failureReason: 'INVALID_CREDENTIALS',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      },
    } as Job<AuthBackgroundJob>);
    expect(prisma.loginAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user',
        success: false,
      }),
    });
  });
});
