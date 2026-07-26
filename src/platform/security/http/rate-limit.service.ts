import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DomainException } from '../../../core';

export interface RateLimitState {
  readonly count: number;
  readonly resetAt: number;
}

export interface RateLimitStore {
  increment(
    key: string,
    windowMs: number,
    now?: number,
  ): Promise<RateLimitState>;
}

export interface InMemoryRateLimitStoreOptions {
  /**
   * Maximum distinct rate-limit keys retained after expired cleanup.
   * When capacity is exhausted the oldest entry is evicted (fail-open) so
   * key-rotation attacks cannot take the API offline.
   * @default 10_000
   */
  readonly maxEntries?: number;
}

/**
 * Bounded in-memory rate-limit store with lazy expired-entry cleanup and
 * LRU-style eviction when capacity is exhausted.
 */
@Injectable()
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly states = new Map<string, RateLimitState>();
  private readonly maxEntries: number;

  public constructor(options: InMemoryRateLimitStoreOptions = {}) {
    const maxEntries = options.maxEntries ?? 10_000;
    if (
      !Number.isFinite(maxEntries) ||
      maxEntries <= 0 ||
      !Number.isInteger(maxEntries)
    ) {
      throw new DomainException(
        'Rate limit maxEntries must be a positive integer',
        'RATE_LIMIT_INVALID_CONFIG',
      );
    }
    this.maxEntries = maxEntries;
  }

  public increment(
    key: string,
    windowMs: number,
    now = Date.now(),
  ): Promise<RateLimitState> {
    this.cleanupExpired(now);
    const current = this.states.get(key);
    const next =
      !current || current.resetAt <= now
        ? { count: 1, resetAt: now + windowMs }
        : { count: current.count + 1, resetAt: current.resetAt };
    if (!this.states.has(key) && this.states.size >= this.maxEntries) {
      // Evict the oldest entry rather than failing closed — a capacity-exhaustion
      // DoS must not take the whole API offline for legitimate clients.
      const oldest = this.states.keys().next().value!;
      this.states.delete(oldest);
    }
    // Re-insert so the key becomes the most-recent Map entry (LRU-ish).
    if (this.states.has(key)) this.states.delete(key);
    this.states.set(key, next);
    return Promise.resolve(next);
  }

  /** Visible for tests — current live entry count after last operation. */
  public size(): number {
    return this.states.size;
  }

  private cleanupExpired(now: number): void {
    for (const [key, state] of this.states) {
      if (state.resetAt <= now) {
        this.states.delete(key);
      }
    }
  }
}

export interface RedisRateLimitClient {
  incrementWithExpiry(key: string, windowMs: number): Promise<RateLimitState>;
}

export class RedisRateLimitStore implements RateLimitStore {
  public constructor(private readonly client: RedisRateLimitClient) {}

  public increment(key: string, windowMs: number): Promise<RateLimitState> {
    return this.client.incrementWithExpiry(key, windowMs);
  }
}

export interface RateLimitResult extends RateLimitState {
  readonly allowed: boolean;
  readonly remaining: number;
}

/**
 * Rate limiter over a {@link RateLimitStore}.
 *
 * **API change:** `consume` validates key/limit/windowMs and rejects invalid
 * configs. `key()` hashes API keys (SHA-256) so secrets never appear in storage keys.
 */
@Injectable()
export class RateLimitService {
  public constructor(private readonly store: RateLimitStore) {}

  public async consume(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    this.assertValidKey(key);
    this.assertPositiveInteger('limit', limit);
    this.assertPositiveInteger('windowMs', windowMs);
    const state = await this.store.increment(key, windowMs);
    return {
      ...state,
      allowed: state.count <= limit,
      remaining: Math.max(0, limit - state.count),
    };
  }

  public key(input: { ip?: string; userId?: string; apiKey?: string }): string {
    if (input.userId) {
      return `user:${input.userId}`;
    }
    if (input.apiKey) {
      const digest = createHash('sha256').update(input.apiKey).digest('hex');
      return `api:${digest}`;
    }
    return `ip:${input.ip ?? 'unknown'}`;
  }

  private assertValidKey(key: string): void {
    if (typeof key !== 'string' || key.length === 0) {
      throw new DomainException(
        'Rate limit key must be a non-empty string',
        'RATE_LIMIT_INVALID_CONFIG',
      );
    }
  }

  private assertPositiveInteger(name: string, value: number): void {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
      throw new DomainException(
        `Rate limit ${name} must be a positive integer`,
        'RATE_LIMIT_INVALID_CONFIG',
      );
    }
  }
}
