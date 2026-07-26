import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { PaymentEvent } from '../domain/payment';
import type { PaymentOutboxPort } from './payment-outbox.port';

/**
 * Durable payment outbox: appends to `outbox_events` and fans out in-process
 * for same-process listeners until a dedicated publisher worker exists.
 */
@Injectable()
export class PrismaPaymentOutbox implements PaymentOutboxPort {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  public async publish(events: readonly PaymentEvent[]): Promise<void> {
    if (events.length === 0) return;
    await this.prisma.$transaction(async (tx) => {
      for (const event of events) {
        await tx.outboxEvent.create({
          data: {
            eventId: event.eventId,
            aggregateId: event.aggregateId,
            eventName: `payments.${event.eventType}`,
            eventVersion: event.version,
            payload: {
              ...event.payload,
              eventType: event.eventType,
              aggregateType: event.aggregateType,
              occurredAt: event.occurredAt,
            } as Prisma.InputJsonValue,
            metadata: { source: 'payments' } as Prisma.InputJsonValue,
            status: 'PENDING',
          },
        });
      }
    });
    for (const event of events) {
      this.events.emit(`payments.${event.eventType}`, event);
      this.events.emit('payment.outbox.requested', event);
    }
  }
}
