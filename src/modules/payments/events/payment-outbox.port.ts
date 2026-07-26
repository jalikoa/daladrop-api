import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { PaymentEvent } from '../domain/payment';

export const PAYMENT_OUTBOX = Symbol('PAYMENT_OUTBOX');

export interface PaymentOutboxPort {
  publish(events: readonly PaymentEvent[]): Promise<void>;
}

/**
 * Integration seam: the parent can replace this provider with its transactional outbox.
 * Events are never discarded; until then they are forwarded to the process event bus.
 */
@Injectable()
export class EventEmitterPaymentOutbox implements PaymentOutboxPort {
  public constructor(@Inject(EventEmitter2) private readonly events: EventEmitter2) {}

  public async publish(events: readonly PaymentEvent[]): Promise<void> {
    for (const event of events) this.events.emit('payment.outbox.requested', event);
  }
}
