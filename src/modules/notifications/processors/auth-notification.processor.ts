import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AUTH_NOTIFICATION_QUEUE } from '../../identity/constants/auth.constants';
import { AuthConfig } from '../../identity/domain/auth.config';
import { EmailService } from '../../../platform/messaging/email/email.service';
import { SmsService } from '../../../platform/messaging/sms/sms.service';
import type { AuthBackgroundJob } from '../domain/auth-job.types';

@Injectable()
@Processor(AUTH_NOTIFICATION_QUEUE, { concurrency: 20 })
export class AuthNotificationProcessor extends WorkerHost {
  public constructor(
    private readonly email: EmailService,
    private readonly sms: SmsService,
    private readonly prisma: PrismaService,
    private readonly config: AuthConfig,
  ) {
    super();
  }

  public async process(job: Job<AuthBackgroundJob>): Promise<void> {
    if (job.data.kind === 'deliver-otp') {
      await this.deliverOtp(job.data);
      await this.prisma.otpChallenge.updateMany({
        where: { id: job.data.challengeId, sentAt: null },
        data: { sentAt: new Date() },
      });
      return;
    }

    await this.prisma.loginAttempt.create({
      data: {
        userId: job.data.userId,
        identifier: job.data.identifier,
        success: job.data.success,
        failureReason: job.data.failureReason,
        ip: job.data.ipAddress,
        userAgent: job.data.userAgent,
      },
    });
  }

  private async deliverOtp(
    job: Extract<AuthBackgroundJob, { kind: 'deliver-otp' }>,
  ): Promise<void> {
    const body = `Your DalaDrop ${this.purpose(job.purpose)} code is ${job.code}. It expires shortly. Never share this code.`;

    if (
      process.env.NODE_ENV !== 'production' ||
      this.config.otpConsoleLog
    ) {
      // eslint-disable-next-line no-console
      console.log(
        `[DEV OTP DELIVERY] purpose=${job.purpose} channel=${job.channel} to=${job.identifier} code=${job.code}`,
      );
    }

    // Skip real provider delivery when none is configured (typical local/dev).
    const skipSend =
      this.config.otpSkipSend ||
      (process.env.NODE_ENV !== 'production' && !this.config.otpForceSend);
    if (skipSend) {
      return;
    }

    if (job.channel === 'EMAIL') {
      await this.email.send(this.config.emailProvider, {
        to: [job.identifier],
        from: this.config.emailFrom,
        subject: `DalaDrop ${this.purpose(job.purpose)} code`,
        text: body,
      });
      return;
    }
    await this.sms.send(this.config.smsProvider, {
      to: job.identifier,
      body,
    });
  }

  private purpose(value: string): string {
    return value.toLowerCase().replaceAll('_', ' ');
  }
}
