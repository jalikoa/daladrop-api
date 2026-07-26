import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ActorType,
  AuditAction,
  BookingStatus,
  EventStatus,
  PaymentStatus,
  Prisma,
  TicketStatus,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';
import { PaymentsService } from '../../payments/use-cases/payments.service';
import type { BuyTicketDto, PayBookingDto } from '../dto/events.dto';
import { EventBookingProviderResolver } from '../listeners/event-booking-payment.listener';

const EVENT_BOOKINGS_TABLE = 'event_bookings';

@Injectable()
export class EventBookingService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: EventEmitter2,
    private readonly payments: PaymentsService,
    private readonly providerResolver: EventBookingProviderResolver,
  ) {}

  public async buy(eventId: string, userId: string, input: BuyTicketDto) {
    const quantity = input.quantity;

    const booking = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { id: eventId, deletedAt: null },
      });
      if (!event || event.status !== EventStatus.PUBLISHED) {
        throw new NotFoundException('Event not found');
      }

      const ticketType = await tx.eventTicketType.findFirst({
        where: {
          id: input.ticketTypeId,
          eventId,
          deletedAt: null,
          isActive: true,
        },
      });
      if (!ticketType) throw new NotFoundException('Ticket type not found');

      // Pending (unpaid) bookings reserve capacity without counting toward
      // soldQty yet, so subtract them from availability to prevent overselling
      // while a customer's M-Pesa STK push is outstanding.
      const pendingReservation = await tx.eventBooking.aggregate({
        where: {
          ticketTypeId: ticketType.id,
          status: BookingStatus.PENDING_PAYMENT,
        },
        _sum: { quantity: true },
      });
      const reservedQty = pendingReservation._sum.quantity ?? 0;
      const available = ticketType.totalQty - ticketType.soldQty - reservedQty;
      if (quantity > available) {
        throw new BadRequestException(
          `Only ${Math.max(0, available)} ticket(s) remaining`,
        );
      }

      const unitPrice = ticketType.priceAmount;
      const amount = unitPrice * BigInt(quantity);
      const isFree = unitPrice === 0n;

      // soldQty only increments once a booking is actually paid (or is free):
      // - Free tickets are confirmed immediately, so bump soldQty now.
      // - Paid tickets stay PENDING_PAYMENT and reserve capacity via the
      //   pendingReservation lookup above; soldQty is incremented by
      //   EventBookingPaymentListener on PaymentCompleted.
      if (isFree) {
        await tx.eventTicketType.update({
          where: { id: ticketType.id },
          data: { soldQty: { increment: quantity } },
        });
      }

      const created = await tx.eventBooking.create({
        data: {
          eventId,
          ticketTypeId: ticketType.id,
          customerId: userId,
          status: isFree ? BookingStatus.PAID : BookingStatus.PENDING_PAYMENT,
          paymentStatus: isFree
            ? PaymentStatus.SUCCESS
            : PaymentStatus.PENDING,
          quantity,
          amount,
          currency: ticketType.currency,
          phone: input.phone ?? null,
          message: isFree
            ? 'Free ticket confirmed.'
            : 'Awaiting payment. Use the pay endpoint to initiate M-Pesa.',
        },
      });

      if (isFree) {
        await tx.eventTicket.createMany({
          data: Array.from({ length: quantity }, () => ({
            bookingId: created.id,
            ticketTypeId: ticketType.id,
            qrCode: this.generateQrCode(),
            status: TicketStatus.VALID,
          })),
        });
      }

      return created;
    });

    await this.audit.record({
      tableName: EVENT_BOOKINGS_TABLE,
      recordId: booking.id,
      action: AuditAction.INSERT,
      actorId: userId,
      actorType: ActorType.USER,
      afterData: {
        status: booking.status,
        quantity: booking.quantity,
        amount: booking.amount.toString(),
      },
      reason: 'Event booking created',
    });

    this.events.emit('events.booking.created', {
      bookingId: booking.id,
      eventId,
      customerId: userId,
      status: booking.status,
    });

    // Convenience: auto-initiate payment when the client supplied a phone
    // number on the buy call, so callers don't need a separate pay round-trip.
    if (booking.status === BookingStatus.PENDING_PAYMENT && input.phone) {
      return this.pay(booking.id, userId, { phone: input.phone });
    }

    const view = await this.getBooking(booking.id, userId);
    return {
      success: true as const,
      bookingId: booking.id,
      ...view,
    };
  }

  public async getBooking(id: string, userId?: string) {
    const booking = await this.prisma.eventBooking.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            venue: true,
            city: true,
            startAt: true,
            coverImageUrl: true,
            bannerUrl: true,
          },
        },
        ticketType: { select: { id: true, name: true, currency: true } },
        tickets: {
          select: { id: true, qrCode: true, status: true, usedAt: true },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (userId && booking.customerId !== userId) {
      throw new ForbiddenException('Cannot access another user booking');
    }
    const view = this.toBookingView(booking);
    return { ...view, booking: view };
  }

  public async pay(bookingId: string, userId: string, input: PayBookingDto) {
    const booking = await this.prisma.eventBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customerId !== userId) {
      throw new ForbiddenException('Cannot pay for another user booking');
    }

    if (booking.status === BookingStatus.PAID || booking.amount === 0n) {
      const view = await this.getBooking(bookingId, userId);
      return {
        success: true as const,
        bookingId,
        mpesa: { initiated: false },
        checkoutRequestId: null,
        ...view,
      };
    }

    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Booking cannot be paid in status ${booking.status}`,
      );
    }

    const phone = this.providerResolver.requirePhone(
      input.phone ?? booking.phone,
    );
    const providerCode = this.providerResolver.resolveProviderCode();
    const payment = await this.payments.createAndInitiate({
      customerId: userId,
      amount: booking.amount,
      currency: booking.currency,
      purpose: 'EVENT_BOOKING',
      providerCode,
      payerIdentifier: phone,
      description: `Event booking ${bookingId}`,
      idempotencyKey: `event-booking-pay:${bookingId}:${providerCode}`,
      eventBookingId: bookingId,
      metadata: { source: 'events.booking.pay', eventBookingId: bookingId },
    });

    const initiated =
      providerCode !== 'MANUAL' &&
      Boolean(payment.checkoutRequestId) &&
      payment.status !== 'FAILED';

    if (providerCode !== 'MANUAL' && !initiated) {
      throw new BadRequestException(
        payment.failureMessage ?? 'Payment provider did not initiate STK',
      );
    }

    await this.prisma.eventBooking.update({
      where: { id: bookingId },
      data: {
        phone,
        paymentStatus: PaymentStatus.PROCESSING,
        message: initiated
          ? 'Payment initiated. Confirm the M-Pesa STK push prompt on your phone.'
          : 'Manual payment created and awaiting authorised approval.',
      },
    });

    await this.audit.record({
      tableName: EVENT_BOOKINGS_TABLE,
      recordId: bookingId,
      action: AuditAction.STATUS_CHANGE,
      actorId: userId,
      actorType: ActorType.USER,
      afterData: {
        paymentId: payment.id,
        paymentStatus: PaymentStatus.PROCESSING,
        providerCode,
        checkoutRequestId: payment.checkoutRequestId ?? null,
      },
      reason: 'Event booking payment requested',
    });

    this.events.emit('events.booking.payment_requested', {
      bookingId,
      paymentId: payment.id,
      customerId: userId,
      amount: booking.amount.toString(),
      currency: booking.currency,
      phone,
      checkoutRequestId: payment.checkoutRequestId ?? null,
    });

    const view = await this.getBooking(bookingId, userId);
    return {
      success: true as const,
      bookingId,
      paymentId: payment.id,
      mpesa: { initiated },
      checkoutRequestId: payment.checkoutRequestId ?? null,
      ...view,
    };
  }

  public async myTickets(userId: string) {
    const tickets = await this.prisma.eventTicket.findMany({
      where: { booking: { customerId: userId } },
      orderBy: { createdAt: 'desc' },
      include: {
        ticketType: { select: { id: true, name: true, currency: true } },
        booking: {
          select: {
            id: true,
            status: true,
            event: {
              select: {
                id: true,
                name: true,
                venue: true,
                city: true,
                startAt: true,
                coverImageUrl: true,
                bannerUrl: true,
              },
            },
          },
        },
      },
    });

    const mapped = tickets.map((ticket) => ({
      id: ticket.id,
      qrCode: ticket.qrCode,
      status: ticket.status,
      usedAt: ticket.usedAt ? ticket.usedAt.toISOString() : null,
      bookingId: ticket.booking.id,
      bookingStatus: ticket.booking.status,
      ticketType: ticket.ticketType,
      event: {
        ...ticket.booking.event,
        startAt: ticket.booking.event.startAt.toISOString(),
      },
    }));
    return { items: mapped, tickets: mapped };
  }

  private toBookingView(
    booking: Prisma.EventBookingGetPayload<{
      include: {
        event: {
          select: {
            id: true;
            name: true;
            venue: true;
            city: true;
            startAt: true;
            coverImageUrl: true;
            bannerUrl: true;
          };
        };
        ticketType: { select: { id: true; name: true; currency: true } };
        tickets: {
          select: { id: true; qrCode: true; status: true; usedAt: true };
        };
      };
    }>,
  ) {
    return {
      id: booking.id,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      quantity: booking.quantity,
      amount: Number(booking.amount),
      currency: booking.currency,
      phone: booking.phone,
      message: booking.message,
      createdAt: booking.createdAt.toISOString(),
      event: {
        ...booking.event,
        startAt: booking.event.startAt.toISOString(),
      },
      ticketType: booking.ticketType,
      tickets: booking.tickets.map((ticket) => ({
        id: ticket.id,
        qrCode: ticket.qrCode,
        status: ticket.status,
        usedAt: ticket.usedAt ? ticket.usedAt.toISOString() : null,
      })),
    };
  }

  private generateQrCode(): string {
    return `evt_${randomUUID()}`;
  }
}
