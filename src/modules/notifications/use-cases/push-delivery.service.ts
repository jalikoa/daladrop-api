import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { HttpClientService } from '../../../infrastructure/external-services/http/http-client.service';
import { ApnsPushProvider } from '../../../platform/messaging/push/apns.provider';
import { FcmPushProvider } from '../../../platform/messaging/push/fcm.provider';
import {
  FirebaseAdminFcmProvider,
  isFirebaseAdminConfigured,
} from '../../../platform/messaging/push/firebase-admin-fcm.provider';
import { PushService } from '../../../platform/messaging/push/push.service';
import type { PushProvider } from '../../../platform/messaging/push/push-provider.interface';
import { NotificationPreferencesService } from './notification-preferences.service';

/** Accepts messages when FCM/APNS credentials are not configured. */
class NoopPushProvider implements PushProvider {
  public readonly name: string;
  public constructor(name: string) {
    this.name = name;
  }
  public async send(message: {
    readonly token: string;
    readonly title: string;
    readonly body: string;
  }) {
    return {
      provider: this.name,
      messageId: `noop-${message.token.slice(0, 8)}`,
      // Never claim live delivery when FCM/APNS are unconfigured.
      accepted: false,
    };
  }
}

@Injectable()
export class PushDeliveryService {
  private readonly logger = new Logger(PushDeliveryService.name);
  private readonly push: PushService;
  private readonly mode: {
    readonly fcm: 'firebase-admin' | 'http' | 'noop';
    readonly apns: 'http' | 'noop';
  };

  public constructor(
    private readonly prisma: PrismaService,
    private readonly preferences: NotificationPreferencesService,
    config: ConfigService,
  ) {
    const providers = this.buildProviders(config);
    this.push = new PushService(providers.providers);
    this.mode = providers.mode;
    this.logger.log(
      `Push delivery ready (fcm=${this.mode.fcm}, apns=${this.mode.apns})`,
    );
  }

  public getDeliveryMode(): Readonly<{
    fcm: 'firebase-admin' | 'http' | 'noop';
    apns: 'http' | 'noop';
  }> {
    return this.mode;
  }

  public async sendToUser(input: {
    readonly userId: string;
    readonly type: string;
    readonly title: string;
    readonly body: string;
    readonly data?: Readonly<Record<string, string>>;
  }): Promise<{ sent: number; skipped: number; mode: string }> {
    const allowed = await this.preferences.isChannelEnabled(
      input.userId,
      'push',
      input.type,
    );
    if (!allowed) return { sent: 0, skipped: 0, mode: this.mode.fcm };

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: input.userId, deletedAt: null },
    });
    let sent = 0;
    let skipped = 0;
    for (const row of tokens) {
      const providerName = this.resolveProvider(row.platform);
      try {
        const result = await this.push.send(providerName, {
          token: row.token,
          title: input.title,
          body: input.body,
          data: input.data,
        });
        const isNoop =
          !result.accepted ||
          result.messageId.startsWith('noop-') ||
          this.mode.fcm === 'noop' ||
          (row.platform.toLowerCase() === 'ios' && this.mode.apns === 'noop');
        if (isNoop) {
          skipped += 1;
          this.logger.debug(
            `Push skipped for token ${row.id} (configure PUSH_PROVIDER_* for live FCM/APNS)`,
          );
        } else {
          sent += 1;
        }
      } catch (error) {
        const message = (error as Error).message;
        this.logger.warn(`Push failed for token ${row.id}: ${message}`);
        if (/UNREGISTERED|InvalidRegistration|not.?found|registration-token-not-registered/i.test(message)) {
          await this.prisma.pushToken.update({
            where: { id: row.id },
            data: { deletedAt: new Date() },
          });
        }
      }
    }
    return { sent, skipped, mode: this.mode.fcm };
  }

  private buildProviders(config: ConfigService): {
    readonly providers: PushProvider[];
    readonly mode: {
      readonly fcm: 'firebase-admin' | 'http' | 'noop';
      readonly apns: 'http' | 'noop';
    };
  } {
    const providers: PushProvider[] = [];
    let fcmMode: 'firebase-admin' | 'http' | 'noop' = 'noop';
    let apnsMode: 'http' | 'noop' = 'noop';

    const projectId = config.get<string>('push.projectId') ?? '';
    const clientEmail = config.get<string>('push.clientEmail') ?? '';
    const privateKey = config.get<string>('push.privateKey') ?? '';

    if (isFirebaseAdminConfigured({ projectId, clientEmail, privateKey })) {
      providers.push(
        new FirebaseAdminFcmProvider({
          projectId,
          clientEmail,
          privateKey,
        }),
      );
      fcmMode = 'firebase-admin';
    } else {
      const fcmEndpoint = (
        process.env.FCM_HTTP_ENDPOINT ??
        process.env.PUSH_FCM_ENDPOINT ??
        ''
      ).trim();
      const fcmToken = (
        process.env.FCM_SERVER_KEY ??
        process.env.PUSH_FCM_TOKEN ??
        ''
      ).trim();
      if (fcmEndpoint && !fcmEndpoint.includes('example.com')) {
        providers.push(
          new FcmPushProvider({
            endpoint: fcmEndpoint,
            token: fcmToken || undefined,
            client: new HttpClientService(),
          }),
        );
        fcmMode = 'http';
      } else {
        providers.push(new NoopPushProvider('fcm'));
      }
    }

    const apnsEndpoint = (
      process.env.APNS_HTTP_ENDPOINT ??
      process.env.PUSH_APNS_ENDPOINT ??
      ''
    ).trim();
    const apnsToken = (
      process.env.APNS_TOKEN ??
      process.env.PUSH_APNS_TOKEN ??
      ''
    ).trim();
    if (apnsEndpoint && !apnsEndpoint.includes('example.com')) {
      providers.push(
        new ApnsPushProvider({
          endpoint: apnsEndpoint,
          token: apnsToken || undefined,
          client: new HttpClientService(),
        }),
      );
      apnsMode = 'http';
    } else if (fcmMode === 'firebase-admin') {
      // iOS tokens registered with Firebase are delivered through FCM Admin.
      // Keep an `apns` provider alias that delegates to the FCM provider.
      const fcmProvider = providers.find((provider) => provider.name === 'fcm');
      if (fcmProvider) {
        providers.push({
          name: 'apns',
          send: (message) => fcmProvider.send(message),
        });
        apnsMode = 'http';
      } else {
        providers.push(new NoopPushProvider('apns'));
      }
    } else {
      providers.push(new NoopPushProvider('apns'));
    }

    return { providers, mode: { fcm: fcmMode, apns: apnsMode } };
  }

  private resolveProvider(platform: string): string {
    const key = platform.trim().toLowerCase();
    if (key === 'ios' || key === 'apns') return 'apns';
    return 'fcm';
  }
}
