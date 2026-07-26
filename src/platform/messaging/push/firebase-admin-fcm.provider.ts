import { Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import type {
  PushMessage,
  PushProvider,
  PushResult,
} from './push-provider.interface';

export interface FirebaseAdminPushCredentials {
  readonly projectId: string;
  readonly clientEmail: string;
  readonly privateKey: string;
}

/**
 * Real-device FCM delivery via Firebase Admin SDK.
 * Handles Android FCM tokens and iOS tokens registered through Firebase.
 */
export class FirebaseAdminFcmProvider implements PushProvider {
  public readonly name = 'fcm';
  private readonly logger = new Logger(FirebaseAdminFcmProvider.name);
  private readonly app: admin.app.App;

  public constructor(credentials: FirebaseAdminPushCredentials) {
    const existing = admin.apps.find(
      (app) => app?.name === 'daladrop-push' || app?.name === '[DEFAULT]',
    );
    this.app =
      existing ??
      admin.initializeApp(
        {
          credential: admin.credential.cert({
            projectId: credentials.projectId,
            clientEmail: credentials.clientEmail,
            privateKey: credentials.privateKey,
          }),
          projectId: credentials.projectId,
        },
        'daladrop-push',
      );
  }

  public async send(message: PushMessage): Promise<PushResult> {
    const response = await this.app.messaging().send({
      token: message.token,
      notification: {
        title: message.title,
        body: message.body,
      },
      data: message.data,
      android: {
        priority: 'high',
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    });
    this.logger.debug(`FCM accepted message ${response}`);
    return {
      provider: this.name,
      messageId: response,
      accepted: true,
    };
  }
}

export function isFirebaseAdminConfigured(input: {
  readonly projectId?: string;
  readonly clientEmail?: string;
  readonly privateKey?: string;
}): boolean {
  const projectId = input.projectId?.trim() ?? '';
  const clientEmail = input.clientEmail?.trim() ?? '';
  const privateKey = input.privateKey?.trim() ?? '';
  if (!projectId || !clientEmail || !privateKey) return false;
  if (projectId.includes('your_project')) return false;
  if (clientEmail.includes('example.com')) return false;
  if (privateKey.includes('...')) return false;
  return true;
}
