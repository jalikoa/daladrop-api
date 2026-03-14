import { Injectable } from '@nestjs/common';
import { PushProvider, PushResponse } from '../interfaces/push-provider.interface';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseProvider implements PushProvider {
  constructor() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    }
  }

  async sendToDevice(token: string, title: string, body: string): Promise<PushResponse> {
    try {
      const response = await admin.messaging().send({
        token,
        notification: { title, body },
      });

      return { success: true, messageId: response };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendToTopic(topic: string, title: string, body: string): Promise<PushResponse> {
    try {
      const response = await admin.messaging().send({
        topic,
        notification: { title, body },
      });

      return { success: true, messageId: response };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
