import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule as BullMqModule } from '@nestjs/bullmq';
import { EmailService } from '../../platform/messaging/email/email.service';
import { SmsService } from '../../platform/messaging/sms/sms.service';
import { SmtpEmailProvider } from '../../infrastructure/external-services/smtp/smtp-email.provider';
import { createSmtpTransport } from '../../infrastructure/external-services/smtp/smtp-transport.factory';
import { HttpSmsProvider } from '../../infrastructure/external-services/sms/http-sms.provider';
import { AfricasTalkingSmsProvider } from '../../infrastructure/external-services/sms/africastalking-sms.provider';
import { HttpClientService } from '../../infrastructure/external-services/http/http-client.service';
import { AUTH_NOTIFICATION_QUEUE } from '../identity/constants/auth.constants';
import { AuthConfig } from '../identity/domain/auth.config';
import { IdentityModule } from '../identity/identity.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthJobDispatcher } from './use-cases/auth-job.dispatcher';
import { AuthNotificationProcessor } from './processors/auth-notification.processor';
import { NotificationsService } from './use-cases/notifications.service';
import { PushTokenService } from './use-cases/push-token.service';
import { PushDeliveryService } from './use-cases/push-delivery.service';
import { NotificationPreferencesService } from './use-cases/notification-preferences.service';
import { AdminNotificationsService } from './use-cases/admin-notifications.service';
import { CustomerNotificationsController } from './interfaces/customer-notifications.controller';
import { PushController } from './interfaces/push.controller';
import { AdminNotificationsController } from './interfaces/admin-notifications.controller';
import { NotificationPreferencesController } from './interfaces/notification-preferences.controller';
import { OrderNotificationsListener } from './listeners/order-notifications.listener';
import { EventBookingNotificationsListener } from './listeners/event-booking-notifications.listener';

@Module({
  imports: [
    BullMqModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host') ?? '127.0.0.1',
          port: config.get<number>('redis.port') ?? 6379,
          password: config.get<string>('redis.password') || undefined,
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullMqModule.registerQueue({ name: AUTH_NOTIFICATION_QUEUE }),
    forwardRef(() => IdentityModule),
    AuthorizationModule,
  ],
  controllers: [
    CustomerNotificationsController,
    PushController,
    AdminNotificationsController,
    NotificationPreferencesController,
  ],
  providers: [
    NotificationPreferencesService,
    PushDeliveryService,
    NotificationsService,
    PushTokenService,
    AdminNotificationsService,
    // RideWorkflowOrchestrator (transport) owns ride notification fan-out.
    OrderNotificationsListener,
    EventBookingNotificationsListener,
    {
      provide: EmailService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): EmailService => {
        const host = config.get<string>('email.host') ?? '';
        if (!host || host.endsWith('example.com')) return new EmailService([]);
        const transport = createSmtpTransport({
          host,
          port: config.get<number>('email.port') ?? 587,
          secure: config.get<boolean>('email.secure') ?? false,
          auth: {
            user: config.get<string>('email.user') ?? '',
            pass: config.get<string>('email.pass') ?? '',
          },
        });
        return new EmailService([new SmtpEmailProvider(transport)]);
      },
    },
    {
      provide: SmsService,
      useFactory: (): SmsService => {
        const atKey = process.env.AT_API_KEY?.trim();
        const atUser = process.env.AT_USERNAME?.trim();
        if (atKey && atUser) {
          const env = (process.env.AT_ENVIRONMENT ?? '').toLowerCase();
          const baseUrl =
            process.env.AT_BASE_URL?.trim() ||
            (env === 'sandbox' || atUser === 'sandbox'
              ? 'https://api.sandbox.africastalking.com'
              : 'https://api.africastalking.com');
          const senderId = process.env.AT_SENDER_ID?.trim();
          return new SmsService([
            new AfricasTalkingSmsProvider({
              username: atUser,
              apiKey: atKey,
              baseUrl,
              senderId:
                senderId && senderId.toLowerCase() !== 'sandbox'
                  ? senderId
                  : undefined,
              name: process.env.AUTH_SMS_PROVIDER ?? 'africastalking',
              client: new HttpClientService(),
            }),
          ]);
        }

        const endpoint = process.env.SMS_PROVIDER_URL;
        if (!endpoint) return new SmsService([]);
        return new SmsService([
          new HttpSmsProvider({
            endpoint,
            token: process.env.SMS_PROVIDER_TOKEN,
            name: process.env.AUTH_SMS_PROVIDER ?? 'http-sms',
            client: new HttpClientService(),
          }),
        ]);
      },
    },
    AuthConfig,
    AuthJobDispatcher,
    AuthNotificationProcessor,
  ],
  exports: [
    AuthJobDispatcher,
    NotificationsService,
    PushTokenService,
    NotificationPreferencesService,
    PushDeliveryService,
    EmailService,
    SmsService,
  ],
})
export class NotificationsModule {}
