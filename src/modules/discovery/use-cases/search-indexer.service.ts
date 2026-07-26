import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { StoreType } from '@prisma/client';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  InMemorySearchEngine,
  SearchService,
  type SearchDocument,
} from '../../../platform/search';
import {
  SEARCH_ENTITY_KINDS,
  SEARCH_INDEX_NAME,
  SEARCH_INDEX_QUEUE,
  type SearchEntityKind,
  type SearchIndexJobName,
} from '../constants/search-index.constants';

export interface IndexedSearchDoc extends SearchDocument {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly description?: string | null;
  readonly subtitle?: string | null;
}

const STORE_KIND: Partial<Record<StoreType, string>> = {
  [StoreType.RESTAURANT]: 'restaurant',
  [StoreType.MARKET]: 'market',
  [StoreType.LIQUOR]: 'liquor',
  [StoreType.GAS]: 'gas',
};

const DEFAULT_JOB_OPTS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 1_000 },
  removeOnComplete: { age: 3_600, count: 10_000 },
  removeOnFail: { age: 7 * 24 * 3_600, count: 50_000 },
};

/**
 * Owns the platform in-memory search engine and incremental reindex helpers.
 * Universal search reads from this shared cache when warm.
 */
@Injectable()
export class SearchIndexerService {
  private readonly logger = new Logger(SearchIndexerService.name);
  private readonly engine: SearchService;
  private warm = false;
  private lastReindexAt: Date | null = null;
  private lastError: string | null = null;
  private pendingJobs = 0;

  public constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SEARCH_INDEX_QUEUE)
    private readonly queue: Queue,
  ) {
    this.engine = new SearchService(new InMemorySearchEngine());
  }

  public get searchEngine(): SearchService {
    return this.engine;
  }

  public get indexName(): string {
    return SEARCH_INDEX_NAME;
  }

  public isWarm(): boolean {
    return this.warm;
  }

  public getStatus() {
    return {
      success: true as const,
      index: SEARCH_INDEX_NAME,
      warm: this.warm,
      lastReindexAt: this.lastReindexAt?.toISOString() ?? null,
      lastError: this.lastError,
      pendingJobs: this.pendingJobs,
      kinds: [...SEARCH_ENTITY_KINDS],
    };
  }

  public async enqueue(
    name: SearchIndexJobName,
    data: Record<string, unknown>,
    jobId?: string,
  ): Promise<string> {
    this.pendingJobs += 1;
    try {
      const queued = await this.queue.add(name, data, {
        ...DEFAULT_JOB_OPTS,
        ...(jobId ? { jobId } : {}),
      });
      if (!queued.id) throw new Error('Queue did not assign a job id');
      return String(queued.id);
    } catch (error) {
      this.pendingJobs = Math.max(0, this.pendingJobs - 1);
      throw error;
    }
  }

  public markJobSettled(): void {
    this.pendingJobs = Math.max(0, this.pendingJobs - 1);
  }

  public async indexEntity(
    kind: SearchEntityKind,
    id: string,
  ): Promise<IndexedSearchDoc | null> {
    const doc = await this.loadDocument(kind, id);
    if (!doc) {
      await this.engine.remove(SEARCH_INDEX_NAME, id);
      return null;
    }
    await this.engine.index(SEARCH_INDEX_NAME, [doc]);
    this.warm = true;
    return doc;
  }

  public async removeEntity(
    kind: SearchEntityKind,
    id: string,
  ): Promise<boolean> {
    void kind;
    const removed = await this.engine.remove(SEARCH_INDEX_NAME, id);
    return removed;
  }

  public async reindexAll(): Promise<{ indexed: number }> {
    return this.reindexBulk([...SEARCH_ENTITY_KINDS]);
  }

  public async reindexBulk(
    kinds: readonly SearchEntityKind[],
  ): Promise<{ indexed: number }> {
    const unique = [...new Set(kinds)];
    try {
      await this.engine.clear(SEARCH_INDEX_NAME);
      const docs: IndexedSearchDoc[] = [];
      for (const kind of unique) {
        docs.push(...(await this.loadMany(kind)));
      }
      if (docs.length > 0) {
        await this.engine.index(SEARCH_INDEX_NAME, docs);
      }
      this.warm = true;
      this.lastReindexAt = new Date();
      this.lastError = null;
      this.logger.log(`Reindexed ${docs.length} docs (${unique.join(',')})`);
      return { indexed: docs.length };
    } catch (error) {
      this.lastError = (error as Error).message;
      this.warm = false;
      throw error;
    }
  }

  private async loadDocument(
    kind: SearchEntityKind,
    id: string,
  ): Promise<IndexedSearchDoc | null> {
    switch (kind) {
      case 'store': {
        const store = await this.prisma.store.findFirst({
          where: { id, deletedAt: null, isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            storeType: true,
            merchant: { select: { name: true } },
          },
        });
        if (!store) return null;
        return {
          id: store.id,
          kind: STORE_KIND[store.storeType] ?? 'merchant',
          name: store.name,
          description: store.description,
          subtitle: store.merchant.name,
        };
      }
      case 'product': {
        const product = await this.prisma.product.findFirst({
          where: { id, deletedAt: null, isActive: true },
          select: { id: true, name: true, description: true },
        });
        if (!product) return null;
        return {
          id: product.id,
          kind: 'product',
          name: product.name,
          description: product.description,
        };
      }
      case 'event': {
        const event = await this.prisma.event.findFirst({
          where: { id, deletedAt: null },
          select: { id: true, name: true, description: true, venue: true },
        });
        if (!event) return null;
        return {
          id: event.id,
          kind: 'event',
          name: event.name,
          description: event.description,
          subtitle: event.venue,
        };
      }
      case 'merchant': {
        const merchant = await this.prisma.merchant.findFirst({
          where: { id, deletedAt: null },
          select: { id: true, name: true, legalName: true },
        });
        if (!merchant) return null;
        return {
          id: merchant.id,
          kind: 'merchant',
          name: merchant.name,
          subtitle: merchant.legalName,
        };
      }
      case 'category': {
        const category = await this.prisma.category.findFirst({
          where: { id, deletedAt: null, isActive: true },
          select: { id: true, name: true, moduleType: true },
        });
        if (!category) return null;
        return {
          id: category.id,
          kind: 'category',
          name: category.name,
          subtitle: category.moduleType,
        };
      }
      default:
        return null;
    }
  }

  private async loadMany(
    kind: SearchEntityKind,
  ): Promise<IndexedSearchDoc[]> {
    switch (kind) {
      case 'store': {
        const stores = await this.prisma.store.findMany({
          where: { deletedAt: null, isActive: true },
          take: 500,
          select: {
            id: true,
            name: true,
            description: true,
            storeType: true,
            merchant: { select: { name: true } },
          },
        });
        return stores.map((store) => ({
          id: store.id,
          kind: STORE_KIND[store.storeType] ?? 'merchant',
          name: store.name,
          description: store.description,
          subtitle: store.merchant.name,
        }));
      }
      case 'product': {
        const products = await this.prisma.product.findMany({
          where: { deletedAt: null, isActive: true },
          take: 800,
          select: { id: true, name: true, description: true },
        });
        return products.map((product) => ({
          id: product.id,
          kind: 'product',
          name: product.name,
          description: product.description,
        }));
      }
      case 'event': {
        const events = await this.prisma.event.findMany({
          where: { deletedAt: null },
          take: 400,
          select: { id: true, name: true, description: true, venue: true },
        });
        return events.map((event) => ({
          id: event.id,
          kind: 'event',
          name: event.name,
          description: event.description,
          subtitle: event.venue,
        }));
      }
      case 'merchant': {
        const merchants = await this.prisma.merchant.findMany({
          where: { deletedAt: null },
          take: 400,
          select: { id: true, name: true, legalName: true },
        });
        return merchants.map((merchant) => ({
          id: merchant.id,
          kind: 'merchant',
          name: merchant.name,
          subtitle: merchant.legalName,
        }));
      }
      case 'category': {
        const categories = await this.prisma.category.findMany({
          where: { deletedAt: null, isActive: true },
          take: 400,
          select: { id: true, name: true, moduleType: true },
        });
        return categories.map((category) => ({
          id: category.id,
          kind: 'category',
          name: category.name,
          subtitle: category.moduleType,
        }));
      }
      default:
        return [];
    }
  }
}
