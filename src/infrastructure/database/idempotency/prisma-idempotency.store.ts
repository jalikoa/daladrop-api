import { type IdempotencyStore } from '../../../platform/api/idempotency/idempotency-store.interface';
import {
  type IdempotencyRecord,
  type IdempotencyRecordState,
  type IdempotencyReserveResult,
} from '../../../platform/api/idempotency/idempotency.types';

/** Sentinel tenant used when the store key is already fully scoped. */
export const IDEMPOTENCY_STORE_TENANT_SENTINEL = '_';

/** Sentinel principal UUID used when the store key is already fully scoped. */
export const IDEMPOTENCY_STORE_PRINCIPAL_SENTINEL =
  '00000000-0000-0000-0000-000000000000';

type IdempotencyStateDb = 'IN_PROGRESS' | 'COMPLETED';

export type IdempotencyRecordRow = {
  readonly id: string;
  readonly key: string;
  readonly requestHash: string;
  readonly ownerToken: string | null;
  readonly state: IdempotencyStateDb;
  readonly responseBody: unknown;
  readonly expiresAt: Date;
};

export type IdempotencyRecordDelegate = {
  findFirst(args: {
    readonly where: {
      readonly key: string;
      readonly tenantId: string;
      readonly principalId: string;
    };
  }): Promise<IdempotencyRecordRow | null>;
  create(args: {
    readonly data: {
      readonly key: string;
      readonly tenantId: string;
      readonly principalId: string;
      readonly method: string;
      readonly path: string;
      readonly requestHash: string;
      readonly ownerToken: string;
      readonly state: IdempotencyStateDb;
      readonly expiresAt: Date;
    };
  }): Promise<IdempotencyRecordRow>;
  update(args: {
    readonly where: { readonly id: string };
    readonly data: {
      readonly requestHash?: string;
      readonly ownerToken?: string | null;
      readonly state?: IdempotencyStateDb;
      readonly responseBody?: unknown;
      readonly expiresAt?: Date;
      readonly method?: string;
      readonly path?: string;
    };
  }): Promise<IdempotencyRecordRow>;
  delete(args: {
    readonly where: { readonly id: string };
  }): Promise<IdempotencyRecordRow>;
};

export type IdempotencyPrismaClient = {
  readonly idempotencyRecord: IdempotencyRecordDelegate;
  $transaction<T>(
    work: (tx: IdempotencyPrismaClient) => Promise<T>,
  ): Promise<T>;
};

export interface PrismaIdempotencyStoreOptions {
  readonly now?: () => number;
  readonly pollIntervalMs?: number;
}

const PRISMA_UNIQUE_VIOLATION = 'P2002';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { readonly code?: string }).code === PRISMA_UNIQUE_VIOLATION
  );
}

function toRecordState(state: IdempotencyStateDb): IdempotencyRecordState {
  return state === 'COMPLETED' ? 'completed' : 'in_progress';
}

function toStoreRecord<T>(row: IdempotencyRecordRow): IdempotencyRecord<T> {
  const record: IdempotencyRecord<T> = {
    fingerprint: row.requestHash,
    ownerToken: row.ownerToken ?? '',
    state: toRecordState(row.state),
    expiresAt: row.expiresAt.getTime(),
  };
  if (row.responseBody !== null && row.responseBody !== undefined) {
    return { ...record, response: row.responseBody as T };
  }
  return record;
}

/**
 * Durable {@link IdempotencyStore} backed by `idempotency_records`.
 *
 * Storage keys from {@link IdempotencyService.scopedKey} are stored as `key`
 * with fixed tenant/principal sentinels so the composite unique constraint
 * behaves like the in-memory single-key map.
 */
export class PrismaIdempotencyStore implements IdempotencyStore {
  private readonly now: () => number;
  private readonly pollIntervalMs: number;

  public constructor(
    private readonly prisma: IdempotencyPrismaClient,
    options: PrismaIdempotencyStoreOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.pollIntervalMs = options.pollIntervalMs ?? 25;
    if (!Number.isFinite(this.pollIntervalMs) || this.pollIntervalMs <= 0) {
      throw new RangeError('Idempotency store pollIntervalMs must be positive');
    }
  }

  public tryReserve(
    key: string,
    fingerprint: string,
    ownerToken: string,
    ttlMilliseconds: number,
  ): Promise<IdempotencyReserveResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findActive(tx, key);
      if (existing !== null) {
        return { kind: 'existing', record: toStoreRecord(existing) };
      }

      const expired = await this.findRow(tx, key);
      const expiresAt = new Date(this.now() + ttlMilliseconds);

      if (expired !== null) {
        const updated = await tx.idempotencyRecord.update({
          where: { id: expired.id },
          data: {
            requestHash: fingerprint,
            ownerToken,
            state: 'IN_PROGRESS',
            responseBody: null,
            expiresAt,
            method: '*',
            path: '*',
          },
        });
        return {
          kind: 'reserved',
          ownerToken: updated.ownerToken ?? ownerToken,
        };
      }

      try {
        await tx.idempotencyRecord.create({
          data: {
            key,
            tenantId: IDEMPOTENCY_STORE_TENANT_SENTINEL,
            principalId: IDEMPOTENCY_STORE_PRINCIPAL_SENTINEL,
            method: '*',
            path: '*',
            requestHash: fingerprint,
            ownerToken,
            state: 'IN_PROGRESS',
            expiresAt,
          },
        });
        return { kind: 'reserved', ownerToken };
      } catch (error: unknown) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
        const raced = await this.findActive(tx, key);
        if (raced === null) {
          throw error;
        }
        return { kind: 'existing', record: toStoreRecord(raced) };
      }
    });
  }

  public async complete<T>(
    key: string,
    ownerToken: string,
    response: T,
    ttlMilliseconds: number,
  ): Promise<void> {
    const existing = await this.findRow(this.prisma, key);
    if (
      existing === null ||
      existing.ownerToken !== ownerToken ||
      existing.state !== 'IN_PROGRESS'
    ) {
      return;
    }
    await this.prisma.idempotencyRecord.update({
      where: { id: existing.id },
      data: {
        state: 'COMPLETED',
        responseBody: response as unknown,
        expiresAt: new Date(this.now() + ttlMilliseconds),
      },
    });
  }

  public async release(key: string, ownerToken: string): Promise<void> {
    const existing = await this.findRow(this.prisma, key);
    if (
      existing !== null &&
      existing.ownerToken === ownerToken &&
      existing.state === 'IN_PROGRESS'
    ) {
      await this.prisma.idempotencyRecord.delete({
        where: { id: existing.id },
      });
    }
  }

  public async get<T>(key: string): Promise<IdempotencyRecord<T> | undefined> {
    const existing = await this.findActive(this.prisma, key);
    if (existing === null) {
      return undefined;
    }
    return toStoreRecord<T>(existing);
  }

  public async waitForCompletion<T>(
    key: string,
    timeoutMs: number,
  ): Promise<IdempotencyRecord<T> | undefined> {
    const deadline = this.now() + timeoutMs;
    for (;;) {
      const current = await this.get<T>(key);
      if (current === undefined || current.state === 'completed') {
        return current;
      }
      const remaining = deadline - this.now();
      if (remaining <= 0) {
        return current;
      }
      await this.sleep(Math.min(this.pollIntervalMs, remaining));
    }
  }

  private findActive(
    client: IdempotencyPrismaClient,
    key: string,
  ): Promise<IdempotencyRecordRow | null> {
    return this.findRow(client, key).then((row) => {
      if (row === null || row.expiresAt.getTime() <= this.now()) {
        return null;
      }
      return row;
    });
  }

  private findRow(
    client: IdempotencyPrismaClient,
    key: string,
  ): Promise<IdempotencyRecordRow | null> {
    return client.idempotencyRecord.findFirst({
      where: {
        key,
        tenantId: IDEMPOTENCY_STORE_TENANT_SENTINEL,
        principalId: IDEMPOTENCY_STORE_PRINCIPAL_SENTINEL,
      },
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      timer.unref();
    });
  }
}
