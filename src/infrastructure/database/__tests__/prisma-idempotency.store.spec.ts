import {
  IDEMPOTENCY_STORE_PRINCIPAL_SENTINEL,
  IDEMPOTENCY_STORE_TENANT_SENTINEL,
  PrismaIdempotencyStore,
  type IdempotencyPrismaClient,
  type IdempotencyRecordRow,
} from '../idempotency/prisma-idempotency.store';

function row(
  overrides: Partial<IdempotencyRecordRow> &
    Pick<IdempotencyRecordRow, 'requestHash' | 'ownerToken' | 'state'>,
): IdempotencyRecordRow {
  return {
    id: overrides.id ?? 'rec-1',
    key: overrides.key ?? 't:_|p:_|k:test',
    requestHash: overrides.requestHash,
    ownerToken: overrides.ownerToken,
    state: overrides.state,
    responseBody: overrides.responseBody ?? null,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
  };
}

function createClient(seed?: IdempotencyRecordRow | null): {
  readonly client: IdempotencyPrismaClient;
  readonly records: Map<string, IdempotencyRecordRow>;
  readonly findFirst: jest.Mock;
  readonly create: jest.Mock;
  readonly update: jest.Mock;
  readonly delete: jest.Mock;
} {
  const records = new Map<string, IdempotencyRecordRow>();
  if (seed) {
    records.set(seed.key, seed);
  }

  const findFirst = jest.fn(
    async (args: {
      readonly where: {
        readonly key: string;
        readonly tenantId: string;
        readonly principalId: string;
      };
    }) => {
      expect(args.where.tenantId).toBe(IDEMPOTENCY_STORE_TENANT_SENTINEL);
      expect(args.where.principalId).toBe(IDEMPOTENCY_STORE_PRINCIPAL_SENTINEL);
      return records.get(args.where.key) ?? null;
    },
  );

  const create = jest.fn(
    async (args: {
      readonly data: {
        readonly key: string;
        readonly requestHash: string;
        readonly ownerToken: string;
        readonly state: 'IN_PROGRESS' | 'COMPLETED';
        readonly expiresAt: Date;
      };
    }) => {
      if (records.has(args.data.key)) {
        const error = Object.assign(new Error('Unique constraint'), {
          code: 'P2002',
        });
        throw error;
      }
      const created = row({
        id: `id-${records.size + 1}`,
        key: args.data.key,
        requestHash: args.data.requestHash,
        ownerToken: args.data.ownerToken,
        state: args.data.state,
        expiresAt: args.data.expiresAt,
      });
      records.set(args.data.key, created);
      return created;
    },
  );

  const update = jest.fn(
    async (args: {
      readonly where: { readonly id: string };
      readonly data: Partial<{
        readonly requestHash: string;
        readonly ownerToken: string | null;
        readonly state: 'IN_PROGRESS' | 'COMPLETED';
        readonly responseBody: unknown;
        readonly expiresAt: Date;
      }>;
    }) => {
      for (const [key, existing] of records) {
        if (existing.id === args.where.id) {
          const next = {
            ...existing,
            ...args.data,
            responseBody:
              args.data.responseBody !== undefined
                ? args.data.responseBody
                : existing.responseBody,
          };
          records.set(key, next);
          return next;
        }
      }
      throw new Error('not found');
    },
  );

  const deleteFn = jest.fn(
    async (args: { readonly where: { readonly id: string } }) => {
      for (const [key, existing] of records) {
        if (existing.id === args.where.id) {
          records.delete(key);
          return existing;
        }
      }
      throw new Error('not found');
    },
  );

  const client: IdempotencyPrismaClient = {
    idempotencyRecord: {
      findFirst,
      create,
      update,
      delete: deleteFn,
    },
    $transaction: async <T>(
      work: (tx: IdempotencyPrismaClient) => Promise<T>,
    ): Promise<T> => work(client),
  };

  return { client, records, findFirst, create, update, delete: deleteFn };
}

describe('PrismaIdempotencyStore', () => {
  it('rejects non-positive pollIntervalMs', () => {
    const { client } = createClient();
    expect(
      () => new PrismaIdempotencyStore(client, { pollIntervalMs: 0 }),
    ).toThrow(RangeError);
  });

  it('reserves a new key and completes with matching owner', async () => {
    let now = 1_000;
    const { client, records } = createClient();
    const store = new PrismaIdempotencyStore(client, { now: () => now });

    const reserved = await store.tryReserve('k1', 'hash-a', 'owner-1', 5_000);
    expect(reserved).toEqual({ kind: 'reserved', ownerToken: 'owner-1' });

    await store.complete('k1', 'owner-1', { ok: true }, 10_000);
    const completed = await store.get<{ ok: boolean }>('k1');
    expect(completed).toEqual({
      fingerprint: 'hash-a',
      ownerToken: 'owner-1',
      state: 'completed',
      expiresAt: now + 10_000,
      response: { ok: true },
    });
    expect(records.get('k1')?.state).toBe('COMPLETED');
  });

  it('returns existing non-expired reservation', async () => {
    const existing = row({
      key: 'k1',
      requestHash: 'hash-a',
      ownerToken: 'owner-1',
      state: 'IN_PROGRESS',
      expiresAt: new Date(50_000),
    });
    const { client } = createClient(existing);
    const store = new PrismaIdempotencyStore(client, { now: () => 1_000 });

    const result = await store.tryReserve('k1', 'hash-b', 'owner-2', 5_000);
    expect(result.kind).toBe('existing');
    if (result.kind === 'existing') {
      expect(result.record.fingerprint).toBe('hash-a');
      expect(result.record.state).toBe('in_progress');
    }
  });

  it('re-reserves expired rows in place', async () => {
    const expired = row({
      key: 'k1',
      requestHash: 'old',
      ownerToken: 'old-owner',
      state: 'COMPLETED',
      responseBody: { stale: true },
      expiresAt: new Date(500),
    });
    const { client, update } = createClient(expired);
    const store = new PrismaIdempotencyStore(client, { now: () => 1_000 });

    const result = await store.tryReserve('k1', 'new-hash', 'owner-2', 5_000);
    expect(result).toEqual({ kind: 'reserved', ownerToken: 'owner-2' });
    expect(update).toHaveBeenCalled();
  });

  it('returns existing when create races on unique constraint', async () => {
    const { client, records, create } = createClient();
    create.mockImplementationOnce(async () => {
      const raced = row({
        key: 'k1',
        requestHash: 'winner',
        ownerToken: 'other',
        state: 'IN_PROGRESS',
        expiresAt: new Date(60_000),
      });
      records.set('k1', raced);
      const error = Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
      });
      throw error;
    });

    const store = new PrismaIdempotencyStore(client, { now: () => 1_000 });
    const result = await store.tryReserve('k1', 'loser', 'me', 5_000);
    expect(result.kind).toBe('existing');
    if (result.kind === 'existing') {
      expect(result.record.fingerprint).toBe('winner');
    }
  });

  it('rethrows unique violation when raced row is missing', async () => {
    const { client, create } = createClient();
    create.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
    );
    const store = new PrismaIdempotencyStore(client, { now: () => 1_000 });
    await expect(
      store.tryReserve('k1', 'hash', 'owner', 5_000),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rethrows non-unique create errors', async () => {
    const { client, create } = createClient();
    create.mockRejectedValueOnce(new Error('db down'));
    const store = new PrismaIdempotencyStore(client);
    await expect(
      store.tryReserve('k1', 'hash', 'owner', 5_000),
    ).rejects.toThrow('db down');
  });

  it('complete and release are no-ops for mismatched owners or states', async () => {
    const completed = row({
      key: 'k1',
      requestHash: 'hash',
      ownerToken: 'owner-1',
      state: 'COMPLETED',
      responseBody: { done: true },
    });
    const {
      client,
      update,
      delete: deleteFn,
      records,
    } = createClient(completed);
    const store = new PrismaIdempotencyStore(client);

    await store.complete('k1', 'owner-1', { x: 1 }, 1_000);
    await store.complete('missing', 'owner-1', { x: 1 }, 1_000);
    await store.release('k1', 'owner-1');
    await store.release('missing', 'owner-1');

    records.set(
      'k2',
      row({
        key: 'k2',
        requestHash: 'hash',
        ownerToken: 'owner-1',
        state: 'IN_PROGRESS',
      }),
    );
    await store.complete('k2', 'wrong-owner', { x: 1 }, 1_000);
    await store.release('k2', 'wrong-owner');

    expect(update).not.toHaveBeenCalled();
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('releases in-progress ownership by deleting the row', async () => {
    const existing = row({
      key: 'k1',
      requestHash: 'hash',
      ownerToken: 'owner-1',
      state: 'IN_PROGRESS',
    });
    const { client, records, delete: deleteFn } = createClient(existing);
    const store = new PrismaIdempotencyStore(client);

    await store.release('k1', 'owner-1');
    expect(deleteFn).toHaveBeenCalled();
    expect(records.has('k1')).toBe(false);
    expect(await store.get('k1')).toBeUndefined();
  });

  it('get ignores expired rows and maps null owner token', async () => {
    const expired = row({
      key: 'k1',
      requestHash: 'hash',
      ownerToken: null,
      state: 'IN_PROGRESS',
      expiresAt: new Date(100),
    });
    const { client, records } = createClient(expired);
    const store = new PrismaIdempotencyStore(client, { now: () => 1_000 });
    expect(await store.get('k1')).toBeUndefined();

    records.set(
      'k2',
      row({
        key: 'k2',
        requestHash: 'hash-2',
        ownerToken: null,
        state: 'IN_PROGRESS',
        expiresAt: new Date(5_000),
      }),
    );
    await expect(store.get('k2')).resolves.toEqual({
      fingerprint: 'hash-2',
      ownerToken: '',
      state: 'in_progress',
      expiresAt: 5_000,
    });
  });

  it('waitForCompletion returns completed records and times out on in-progress', async () => {
    let now = 0;
    const inProgress = row({
      key: 'k1',
      requestHash: 'hash',
      ownerToken: 'owner-1',
      state: 'IN_PROGRESS',
      expiresAt: new Date(100_000),
    });
    const { client, records } = createClient(inProgress);
    const store = new PrismaIdempotencyStore(client, {
      now: () => now,
      pollIntervalMs: 5,
    });

    const timedOutPromise = store.waitForCompletion('k1', 50);
    await new Promise((resolve) => setTimeout(resolve, 15));
    now = 100;
    const stillInProgress = await timedOutPromise;
    expect(stillInProgress?.state).toBe('in_progress');

    now = 200;
    records.set(
      'k1',
      row({
        key: 'k1',
        requestHash: 'hash',
        ownerToken: 'owner-1',
        state: 'COMPLETED',
        responseBody: { ok: true },
        expiresAt: new Date(100_000),
      }),
    );
    const done = await store.waitForCompletion<{ ok: boolean }>('k1', 50);
    expect(done).toEqual(
      expect.objectContaining({
        state: 'completed',
        response: { ok: true },
      }),
    );

    records.delete('k1');
    expect(await store.waitForCompletion('k1', 1)).toBeUndefined();
  });

  it('maps reserved update when ownerToken is null on returned row', async () => {
    const expired = row({
      key: 'k1',
      requestHash: 'old',
      ownerToken: 'old',
      state: 'IN_PROGRESS',
      expiresAt: new Date(1),
    });
    const { client, update } = createClient(expired);
    update.mockResolvedValueOnce(
      row({
        key: 'k1',
        requestHash: 'new',
        ownerToken: null,
        state: 'IN_PROGRESS',
        expiresAt: new Date(10_000),
      }),
    );
    const store = new PrismaIdempotencyStore(client, { now: () => 100 });
    const result = await store.tryReserve('k1', 'new', 'owner-x', 1_000);
    expect(result).toEqual({ kind: 'reserved', ownerToken: 'owner-x' });
  });
});
