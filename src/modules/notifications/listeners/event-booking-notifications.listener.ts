import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../use-cases/notifications.service';
import { NotificationType } from '../domain/notification.types';

interface EventBookingPaymentPayload {
  readonly bookingId: string;
  readonly paymentId: string;
  readonly customerId: string;
}

/**
 * Thin in-app notification writer for event ticket bookings. Never throws
 * back into the emitter — a failure to notify must not fail booking or
 * payment processing.
 */
@Injectable()
export class EventBookingNotificationsListener {
  private readonly logger = new Logger(EventBookingNotificationsListener.name);

  public constructor(private readonly notifications: NotificationsService) {}

  @OnEvent('eventBookingPaymentConfirmed')
  public async onPaymentConfirmed(
    event: EventBookingPaymentPayload,
  ): Promise<void> {
    await this.safeCreate(event.customerId, {
      userId: event.customerId,
      type: NotificationType.EVENT_BOOKING,
      title: 'Tickets confirmed',
      body: 'Your payment was confirmed and your tickets are ready.',
      bookingId: event.bookingId,
      data: { paymentId: event.paymentId },
    });
  }

  @OnEvent('eventBookingPaymentFailed')
  public async onPaymentFailed(event: EventBookingPaymentPayload): Promise<void> {
    await this.safeCreate(event.customerId, {
      userId: event.customerId,
      type: NotificationType.EVENT_BOOKING,
      title: 'Ticket payment failed',
      body: 'Your ticket payment failed. You can retry from the app.',
      bookingId: event.bookingId,
      data: { paymentId: event.paymentId },
    });
  }

  private async safeCreate(
    customerId: string | undefined,
    input: Parameters<NotificationsService['createInApp']>[0],
  ): Promise<void> {
    if (!customerId) return;
    try {
      await this.notifications.createInApp(input);
    } catch (error) {
      this.logger.error(
        `Failed to write booking notification for ${customerId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
