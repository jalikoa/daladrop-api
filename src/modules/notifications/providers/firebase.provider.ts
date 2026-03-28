import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PushProvider, PushResponse } from '../interfaces/push-provider.interface';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseProvider implements PushProvider {
  private readonly logger = new Logger(FirebaseProvider.name);
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {
    // Firebase initialization is deferred until first use
    // Set up device token configuration here when ready
  }

  private initializeFirebase(): void {
    if (this.isInitialized) {
      return;
    }

    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase credentials not fully configured. Push notifications disabled.');
      return;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      this.isInitialized = true;
      this.logger.log('Firebase Admin SDK initialized successfully');
    }
  }

  async sendToDevice(token: string, title: string, body: string): Promise<PushResponse> {
    this.logger.log(`Sending push notification via Firebase`);
    this.logger.log(`   Device Token: ${token}`);
    this.logger.log(`   Title: ${title}`);
    this.logger.log(`   Body: ${body}`);

    // TODO: Replace with actual device token management
    // For now, this is a placeholder until device tokens are available
    if (!token || token === 'placeholder' || token.startsWith('TODO:')) {
      this.logger.warn('No valid device token provided. Push notification skipped.');
      return {
        success: false,
        error: 'Device token not configured. Please add valid FCM device token.',
      };
    }

    try {
      this.initializeFirebase();

      if (!this.isInitialized) {
        return {
          success: false,
          error: 'Firebase not initialized. Check credentials.',
        };
      }

      const response = await admin.messaging().send({
        token,
        notification: { title, body },
      });

      this.logger.log(`   Push notification sent successfully`);
      this.logger.log(`   Message ID: ${response}`);

      return { success: true, messageId: response };
    } catch (error) {
      this.logger.error(`   Push notification sending failed: ${(error as Error).message}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendToTopic(topic: string, title: string, body: string): Promise<PushResponse> {
    this.logger.log(`Sending push notification to topic: ${topic}`);

    try {
      this.initializeFirebase();

      if (!this.isInitialized) {
        return {
          success: false,
          error: 'Firebase not initialized. Check credentials.',
        };
      }

      const response = await admin.messaging().send({
        topic,
        notification: { title, body },
      });

      this.logger.log(`   Topic notification sent successfully`);
      this.logger.log(`   Message ID: ${response}`);

      return { success: true, messageId: response };
    } catch (error) {
      this.logger.error(`   Topic notification sending failed: ${(error as Error).message}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
