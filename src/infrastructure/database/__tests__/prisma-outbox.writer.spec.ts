import { PrismaOutboxWriter } from '../outbox/prisma-outbox.writer';
import type {
  OutboxAppendedEvent,
  OutboxPrismaClient,
} from '../outbox/outbox-writer.interface';

function appended(
  overrides: Partial<OutboxAppendedEvent> = {},
): OutboxAppendedEvent {
  return {
    id: overrides.id ?? 'outbox-1',
    eventId: overrides.eventId ?? 'evt-1',
    aggregateId: overrides.aggregateId ?? 'agg-1',
    eventName: overrides.eventName ?? 'payment.succeeded',
    eventVersion: overrides.eventVersion ?? 1,
    payload: overrides.payload ?? { paymentId: 'p1' },
    metadata: overrides.metadata ?? null,
    status: overrides.status ?? 'PENDING',
    attempts: overrides.attempts ?? 0,
    availableAt: overrides.availableAt ?? new Date('2026-07-26T00:00:00.000Z'),
    publishedAt: overrides.publishedAt ?? null,
    lastError: overrides.lastError ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-07-26T00:00:00.000Z'),
  };
}

describe('PrismaOutboxWriter', () => {
  it('appends a pending outbox row via the root client', async () => {
    const create = jest.fn(async () => appended());
    const client: OutboxPrismaClient = { outboxEvent: { create } };
    const writer = new PrismaOutboxWriter(client);

    const result = await writer.append({
      eventId: 'evt-1',
      aggregateId: 'agg-1',
      eventName: 'payment.succeeded',
      payload: { paymentId: 'p1' },
    });

    expect(result.eventId).toBe('evt-1');
    expect(create).toHaveBeenCalledWith({
      data: {
        eventId: 'evt-1',
        aggregateId: 'agg-1',
        eventName: 'payment.succeeded',
        eventVersion: 1,
        payload: { paymentId: 'p1' },
        status: 'PENDING',
      },
    });
  });

  it('uses a transaction client when provided and forwards optional fields', async () => {
    const rootCreate = jest.fn();
    const txCreate = jest.fn(async () =>
      appended({ eventId: 'evt-2', eventVersion: 3 }),
    );
    const root: OutboxPrismaClient = { outboxEvent: { create: rootCreate } };
    const tx: OutboxPrismaClient = { outboxEvent: { create: txCreate } };
    const writer = new PrismaOutboxWriter(root);
    const availableAt = new Date('2026-07-26T12:00:00.000Z');

    await writer.append(
      {
        eventId: 'evt-2',
        aggregateId: 'agg-2',
        eventName: 'payment.failed',
        eventVersion: 3,
        payload: { reason: 'declined' },
        metadata: { correlationId: 'c1' },
        availableAt,
      },
      tx,
    );

    expect(rootCreate).not.toHaveBeenCalled();
    expect(txCreate).toHaveBeenCalledWith({
      data: {
        eventId: 'evt-2',
        aggregateId: 'agg-2',
        eventName: 'payment.failed',
        eventVersion: 3,
        payload: { reason: 'declined' },
        metadata: { correlationId: 'c1' },
        availableAt,
        status: 'PENDING',
      },
    });
  });

  it('validates required fields and eventVersion', async () => {
    const client: OutboxPrismaClient = {
      outboxEvent: { create: jest.fn() },
    };
    const writer = new PrismaOutboxWriter(client);

    expect(() =>
      writer.append({
        eventId: '  ',
        aggregateId: 'a',
        eventName: 'e',
        payload: {},
      }),
    ).toThrow(/eventId/);
    expect(() =>
      writer.append({
        eventId: 'e',
        aggregateId: '',
        eventName: 'e',
        payload: {},
      }),
    ).toThrow(/aggregateId/);
    expect(() =>
      writer.append({
        eventId: 'e',
        aggregateId: 'a',
        eventName: ' ',
        payload: {},
      }),
    ).toThrow(/eventName/);
    expect(() =>
      writer.append({
        eventId: 'e',
        aggregateId: 'a',
        eventName: 'n',
        eventVersion: 0,
        payload: {},
      }),
    ).toThrow(/eventVersion/);
    expect(() =>
      writer.append({
        eventId: 'e',
        aggregateId: 'a',
        eventName: 'n',
        eventVersion: 1.5,
        payload: {},
      }),
    ).toThrow(/eventVersion/);
  });
});
