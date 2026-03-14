import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationProcessor } from './processors/notification.processor';
import { NotificationListener } from './listeners/notification.listener';
import { SendNotificationUseCase } from './use-cases/send-notification.usecase';
import { AfricaTalkingProvider } from './providers/africastalking.provider';
import { NodemailerProvider } from './providers/nodemailer.provider';
import { FirebaseProvider } from './providers/firebase.provider';
import { UsersModule } from '../users/users.module';
import { NOTIFICATION_CONSTANTS } from './constants/notification.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification], 'notifications'),
    BullModule.registerQueue({
      name: NOTIFICATION_CONSTANTS.QUEUE.NAME,
      defaultJobOptions: {
        attempts: NOTIFICATION_CONSTANTS.RETRY.MAX_ATTEMPTS,
        backoff: {
          type: NOTIFICATION_CONSTANTS.RETRY.BACKOFF_TYPE as any,
          delay: NOTIFICATION_CONSTANTS.RETRY.BACKOFF_DELAY_MS,
        },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    }),
    EventEmitterModule.forRoot(),
    UsersModule,
  ],
  providers: [
    NotificationsService,
    NotificationProcessor,
    NotificationListener,
    SendNotificationUseCase,
    AfricaTalkingProvider,
    { provide: 'ISmsProvider', useExisting: AfricaTalkingProvider },
    NodemailerProvider,
    { provide: 'IEmailProvider', useExisting: NodemailerProvider },
    FirebaseProvider,
    { provide: 'IPushProvider', useExisting: FirebaseProvider },
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
