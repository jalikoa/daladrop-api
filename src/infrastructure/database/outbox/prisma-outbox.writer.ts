import {
  type OutboxAppendedEvent,
  type OutboxAppendInput,
  type OutboxPrismaClient,
  type OutboxWriter,
} from './outbox-writer.interface';

/**
 * Durable outbox appender for `outbox_events`.
 *
 * Pass an interactive transaction client as the second argument so domain
 * mutations and the outbox row share one commit boundary.
 */
export class PrismaOutboxWriter implements OutboxWriter {
  public constructor(private readonly prisma: OutboxPrismaClient) {}

  public append(
    input: OutboxAppendInput,
    tx?: OutboxPrismaClient,
  ): Promise<OutboxAppendedEvent> {
    this.assertInput(input);
    const client = tx ?? this.prisma;
    return client.outboxEvent.create({
      data: {
        eventId: input.eventId,
        aggregateId: input.aggregateId,
        eventName: input.eventName,
        eventVersion: input.eventVersion ?? 1,
        payload: input.payload as object,
        ...(input.metadata !== undefined
          ? { metadata: input.metadata as object }
          : {}),
        ...(input.availableAt !== undefined
          ? { availableAt: input.availableAt }
          : {}),
        status: 'PENDING',
      },
    });
  }

  private assertInput(input: OutboxAppendInput): void {
    if (input.eventId.trim() === '') {
      throw new RangeError('Outbox eventId is required');
    }
    if (input.aggregateId.trim() === '') {
      throw new RangeError('Outbox aggregateId is required');
    }
    if (input.eventName.trim() === '') {
      throw new RangeError('Outbox eventName is required');
    }
    if (
      input.eventVersion !== undefined &&
      (!Number.isInteger(input.eventVersion) || input.eventVersion < 1)
    ) {
      throw new RangeError('Outbox eventVersion must be a positive integer');
    }
  }
}
