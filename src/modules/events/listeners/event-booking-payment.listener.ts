import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BookingStatus,
  PaymentStatus,
  TicketStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { PaymentEvent } from '../../payments/domain/payment';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Reacts to durable/in-process payment domain events for event bookings.
 * Issues tickets only after PaymentCompleted (never on STK initiate).
 */
@Injectable()
export class EventBookingPaymentListener {
  private readonly logger = new Logger(EventBookingPaymentListener.name);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @OnEvent('payments.PaymentCompleted')
  public async onPaymentCompleted(event: PaymentEvent): Promise<void> {
    const bookingId = await this.resolveBookingId(event);
    if (!bookingId) return;

    const booking = await this.prisma.eventBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      this.logger.warn(
        `PaymentCompleted for missing booking ${bookingId} (${event.aggregateId})`,
      );
      return;
    }
    if (booking.status === BookingStatus.PAID) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.eventBooking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.PAID,
          paymentStatus: PaymentStatus.SUCCESS,
          message: 'Payment confirmed.',
        },
      });
      const existing = await tx.eventTicket.count({
        where: { bookingId: booking.id },
      });
      if (existing === 0) {
        // Paid bookings only reserved capacity at buy time (see
        // EventBookingService.buy) — soldQty is incremented here, once
        // payment actually completes, to avoid overselling free-riding
        // abandoned/failed STK pushes.
        await tx.eventTicketType.update({
          where: { id: booking.ticketTypeId },
          data: { soldQty: { increment: booking.quantity } },
        });
        await tx.eventTicket.createMany({
          data: Array.from({ length: booking.quantity }, () => ({
            bookingId: booking.id,
            ticketTypeId: booking.ticketTypeId,
            qrCode: `evt_${randomUUID()}`,
            status: TicketStatus.VALID,
          })),
        });
      }
    });

    this.events.emit('eventBookingPaymentConfirmed', {
      bookingId: booking.id,
      paymentId: event.aggregateId,
      customerId: booking.customerId,
    });
  }

  @OnEvent('payments.PaymentFailed')
  public async onPaymentFailed(event: PaymentEvent): Promise<void> {
    const bookingId = await this.resolveBookingId(event);
    if (!bookingId) return;
    const booking = await this.prisma.eventBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking || booking.status === BookingStatus.PAID) return;

    await this.prisma.eventBooking.update({
      where: { id: booking.id },
      data: {
        paymentStatus: PaymentStatus.FAILED,
        message:
          typeof event.payload.message === 'string'
            ? event.payload.message
            : 'Payment failed. You can retry.',
      },
    });

    this.events.emit('eventBookingPaymentFailed', {
      bookingId: booking.id,
      paymentId: event.aggregateId,
      customerId: booking.customerId,
    });
  }

  private async resolveBookingId(event: PaymentEvent): Promise<string | null> {
    const fromPayload = event.payload.eventBookingId;
    if (typeof fromPayload === 'string' && fromPayload.length > 0) {
      return fromPayload;
    }
    const payment = await this.prisma.payment.findUnique({
      where: { id: event.aggregateId },
      select: { eventBookingId: true, purpose: true },
    });
    if (!payment || payment.purpose !== 'EVENT_BOOKING') return null;
    return payment.eventBookingId;
  }
}

@Injectable()
export class EventBookingProviderResolver {
  public constructor(private readonly config: ConfigService) {}

  public resolveProviderCode(): string {
    if (this.config.get<string>('DARAJA_ENABLED') === 'true') {
      return 'MPESA_DARAJA';
    }
    if (this.config.get<string>('KOPOKOPO_ENABLED') === 'true') {
      return 'KOPOKOPO';
    }
    return 'MANUAL';
  }

  public normalizePhone(value?: string | null): string | null {
    if (!value) return null;
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('254') && digits.length === 12) return digits;
    if (digits.startsWith('0') && digits.length === 10) {
      return `254${digits.slice(1)}`;
    }
    if (
      digits.length === 9 &&
      (digits.startsWith('7') || digits.startsWith('1'))
    ) {
      return `254${digits}`;
    }
    return null;
  }

  public requirePhone(value?: string | null): string {
    const phone = this.normalizePhone(value);
    if (!phone) {
      throw new BadRequestException(
        'A valid Kenyan mpesaPhone / phone is required for paid bookings',
      );
    }
    return phone;
  }
}
