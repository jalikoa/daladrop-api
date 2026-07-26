/**
 * Transactional outbox writer contract.
 *
 * Writers append durable rows to `outbox_events` for a separate publisher
 * process to drain. This abstraction never publishes to a broker.
 */

export type OutboxAppendInput = {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly eventName: string;
  readonly eventVersion?: number;
  readonly payload: unknown;
  readonly metadata?: unknown;
  readonly availableAt?: Date;
};

export type OutboxAppendedEvent = {
  readonly id: string;
  readonly eventId: string;
  readonly aggregateId: string;
  readonly eventName: string;
  readonly eventVersion: number;
  readonly payload: unknown;
  readonly metadata: unknown;
  readonly status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  readonly attempts: number;
  readonly availableAt: Date;
  readonly publishedAt: Date | null;
  readonly lastError: string | null;
  readonly createdAt: Date;
};

export interface OutboxWriter {
  /**
   * Persist an outbox row. When `tx` is provided, the write participates in
   * that transaction so payment state and the event commit atomically.
   */
  append(
    input: OutboxAppendInput,
    tx?: OutboxPrismaClient,
  ): Promise<OutboxAppendedEvent>;
}

/**
 * Minimal Prisma surface needed by {@link PrismaOutboxWriter}.
 * Kept structural/loose so Nest `PrismaService` assigns without Json casts.
 */
export type OutboxPrismaClient = {
  readonly outboxEvent: {
    create(args: {
      data: Record<string, unknown>;
    }): Promise<OutboxAppendedEvent>;
  };
};
