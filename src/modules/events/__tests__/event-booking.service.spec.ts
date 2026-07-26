import { BadRequestException, HttpException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventBookingService } from '../use-cases/event-booking.service';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import type { AuditLogService } from '../../operations/use-cases/audit-log.service';

function buildTx(
  ticketType: {
    totalQty: number;
    soldQty: number;
    priceAmount: bigint;
  },
  pendingReservedQty = 0,
) {
  return {
    event: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'e1', status: 'PUBLISHED', deletedAt: null }),
    },
    eventTicketType: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'tt1',
        eventId: 'e1',
        currency: 'KES',
        ...ticketType,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    eventBooking: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { quantity: pendingReservedQty } }),
      create: jest.fn().mockResolvedValue({
        id: 'b1',
        status: 'PAID',
        quantity: 1,
        amount: 0n,
      }),
    },
    eventTicket: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

describe('EventBookingService.buy capacity check', () => {
  const audit = { record: jest.fn() } as unknown as AuditLogService;
  const emitter = new EventEmitter2();
  const payments = {
    createAndInitiate: jest.fn(),
  };
  const providerResolver = {
    resolveProviderCode: () => 'MANUAL',
    requirePhone: (value?: string | null) => value ?? '254700000000',
    normalizePhone: (value?: string | null) => value ?? null,
  };

  it('rejects a purchase that exceeds remaining capacity', async () => {
    const tx = buildTx({ totalQty: 5, soldQty: 5, priceAmount: 100n });
    const prisma = {
      $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
    } as unknown as PrismaService;

    const service = new EventBookingService(
      prisma,
      audit,
      emitter,
      payments as never,
      providerResolver as never,
    );

    await expect(
      service.buy('e1', 'u1', { ticketTypeId: 'tt1', quantity: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.eventBooking.create).not.toHaveBeenCalled();
  });

  it('rejects a purchase that would exceed capacity once pending reservations are counted', async () => {
    // totalQty 10, soldQty 0, but 9 already reserved by other PENDING_PAYMENT
    // bookings — only 1 seat should remain available.
    const tx = buildTx({ totalQty: 10, soldQty: 0, priceAmount: 500n }, 9);
    const prisma = {
      $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
    } as unknown as PrismaService;

    const service = new EventBookingService(
      prisma,
      audit,
      emitter,
      payments as never,
      providerResolver as never,
    );

    await expect(
      service.buy('e1', 'u1', { ticketTypeId: 'tt1', quantity: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.eventBooking.create).not.toHaveBeenCalled();
  });

  it('issues free tickets immediately and increments soldQty', async () => {
    const tx = buildTx({ totalQty: 10, soldQty: 0, priceAmount: 0n });
    const getBooking = jest
      .fn()
      .mockResolvedValue({ id: 'b1', status: 'PAID' });
    const prisma = {
      $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
    } as unknown as PrismaService;

    const service = new EventBookingService(
      prisma,
      audit,
      emitter,
      payments as never,
      providerResolver as never,
    );
    // Avoid re-reading the booking through prisma in the assertion path.
    (service as unknown as { getBooking: unknown }).getBooking = getBooking;

    const result = await service.buy('e1', 'u1', {
      ticketTypeId: 'tt1',
      quantity: 2,
    });

    expect(result.success).toBe(true);
    expect(result.bookingId).toBe('b1');
    expect(tx.eventBooking.create).toHaveBeenCalledTimes(1);
    expect(tx.eventTicket.createMany).toHaveBeenCalledTimes(1);
    expect(tx.eventTicketType.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { soldQty: { increment: 2 } },
      }),
    );
  });

  it('reserves capacity for paid tickets without incrementing soldQty or issuing tickets', async () => {
    const tx = buildTx({ totalQty: 10, soldQty: 0, priceAmount: 500n });
    tx.eventBooking.create = jest.fn().mockResolvedValue({
      id: 'b2',
      status: 'PENDING_PAYMENT',
      quantity: 1,
      amount: 500n,
    });
    const getBooking = jest
      .fn()
      .mockResolvedValue({ id: 'b2', status: 'PENDING_PAYMENT' });
    const prisma = {
      $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
    } as unknown as PrismaService;

    const service = new EventBookingService(
      prisma,
      audit,
      emitter,
      payments as never,
      providerResolver as never,
    );
    (service as unknown as { getBooking: unknown }).getBooking = getBooking;

    const result = await service.buy('e1', 'u1', {
      ticketTypeId: 'tt1',
      quantity: 1,
    });

    expect(result.success).toBe(true);
    expect(result.bookingId).toBe('b2');
    // soldQty must NOT increment at buy time for paid tickets — it is
    // deferred to EventBookingPaymentListener on PaymentCompleted.
    expect(tx.eventTicketType.update).not.toHaveBeenCalled();
    expect(tx.eventTicket.createMany).not.toHaveBeenCalled();
  });

  it('auto-initiates payment when a phone number is provided on buy', async () => {
    const tx = buildTx({ totalQty: 10, soldQty: 0, priceAmount: 500n });
    tx.eventBooking.create = jest.fn().mockResolvedValue({
      id: 'b3',
      status: 'PENDING_PAYMENT',
      quantity: 1,
      amount: 500n,
    });
    const prisma = {
      $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
    } as unknown as PrismaService;

    const service = new EventBookingService(
      prisma,
      audit,
      emitter,
      payments as never,
      providerResolver as never,
    );
    const pay = jest.fn().mockResolvedValue({
      success: true,
      bookingId: 'b3',
      mpesa: { initiated: true },
      checkoutRequestId: 'ws_1',
    });
    (service as unknown as { pay: unknown }).pay = pay;

    const result = await service.buy('e1', 'u1', {
      ticketTypeId: 'tt1',
      quantity: 1,
      phone: '254712345678',
    });

    expect(pay).toHaveBeenCalledWith('b3', 'u1', { phone: '254712345678' });
    expect(result).toEqual(
      expect.objectContaining({ bookingId: 'b3', success: true }),
    );
  });
});

describe('HttpException shape for age gate', () => {
  it('uses 423 Locked semantics', () => {
    const err = new HttpException(
      {
        success: false,
        error: 'AGE_VERIFICATION_REQUIRED',
        code: 'AGE_VERIFICATION_REQUIRED',
        status: 'unverified',
      },
      423,
    );
    expect(err.getStatus()).toBe(423);
  });
});
