import { Injectable, Optional } from '@nestjs/common';
import { StoreType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  InMemorySearchEngine,
  SearchService,
  type SearchDocument,
} from '../../../platform/search';
import { PaginationService } from '../../../platform/api/pagination/pagination.service';
import {
  SearchIndexerService,
  type IndexedSearchDoc,
} from './search-indexer.service';

export type SearchScope =
  | 'all'
  | 'restaurants'
  | 'products'
  | 'events'
  | 'merchants'
  | 'markets'
  | 'liquor'
  | 'gas'
  | 'transport'
  | 'parcels';

export interface UniversalSearchQuery {
  readonly q?: string;
  readonly search?: string;
  readonly scope?: SearchScope;
  readonly page?: number;
  readonly limit?: number;
  readonly sort?: string;
  /** Opaque cursor for keyset pagination (preferred over page). */
  readonly cursor?: string;
  /** When true, include facet counts by kind. */
  readonly facets?: boolean | string;
}

interface IndexedDoc extends SearchDocument {
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

/**
 * Universal search facade. Prefers the shared {@link SearchIndexerService}
 * cache when warm; otherwise builds a scoped snapshot into that engine.
 */
@Injectable()
export class UniversalSearchService {
  private readonly pagination = new PaginationService(20, 50);
  private readonly fallbackEngine: SearchService;
  private readonly INDEX = 'daladrop';

  public constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly indexer?: SearchIndexerService,
  ) {
    this.fallbackEngine = new SearchService(new InMemorySearchEngine());
  }

  private get engine(): SearchService {
    return this.indexer?.searchEngine ?? this.fallbackEngine;
  }

  private get indexName(): string {
    return this.indexer?.indexName ?? this.INDEX;
  }

  public async search(query: UniversalSearchQuery) {
    const text = (query.q ?? query.search ?? '').trim();
    const scope = (query.scope ?? 'all') as SearchScope;
    const wantFacets =
      query.facets === true ||
      query.facets === 'true' ||
      query.facets === '1';
    const { page, limit } = this.pagination.normalizeOffset({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    await this.ensureIndex(scope);

    let offset = (page - 1) * limit;
    if (query.cursor?.trim()) {
      try {
        const decoded = this.pagination.decodeCursor(query.cursor.trim());
        const parsed = Number(decoded);
        if (Number.isSafeInteger(parsed) && parsed >= 0) offset = parsed;
      } catch {
        offset = (page - 1) * limit;
      }
    }

    const results = await this.engine.search<IndexedDoc>({
      index: this.indexName,
      query: text,
      fields: ['name', 'description', 'subtitle', 'kind'],
      fuzzy: true,
      offset,
      limit,
      sort:
        query.sort === 'name_desc'
          ? [{ field: 'name', direction: 'desc' }]
          : query.sort === 'score' || query.sort === 'relevance'
            ? undefined
            : [{ field: 'name', direction: 'asc' }],
      filters: scope === 'all' ? undefined : { kind: this.kindForScope(scope) },
    });

    const items = results.hits.map((hit) => ({
      id: hit.item.id,
      kind: hit.item.kind,
      name: hit.item.name,
      description: hit.item.description ?? null,
      subtitle: hit.item.subtitle ?? null,
      score: hit.score,
    }));

    const nextOffset = offset + items.length;
    const hasMore = nextOffset < results.total;
    const nextCursor = hasMore
      ? this.pagination.encodeCursor(String(nextOffset))
      : null;

    let facets: Record<string, number> | undefined;
    if (wantFacets) {
      const facetScan = await this.engine.search<IndexedDoc>({
        index: this.indexName,
        query: text,
        fields: ['name', 'description', 'subtitle', 'kind'],
        fuzzy: true,
        offset: 0,
        limit: Math.min(results.total || 500, 1000),
      });
      facets = {};
      for (const hit of facetScan.hits) {
        const kind = String(hit.item.kind ?? 'unknown');
        facets[kind] = (facets[kind] ?? 0) + 1;
      }
    }

    return {
      success: true as const,
      items,
      page: Math.floor(offset / limit) + 1,
      hasMore,
      total: results.total,
      query: text,
      scope,
      nextCursor,
      ...(facets ? { facets } : {}),
    };
  }

  public async autocomplete(input: {
    readonly q?: string;
    readonly search?: string;
    readonly limit?: number;
  }) {
    const prefix = (input.q ?? input.search ?? '').trim();
    if (!prefix) {
      return { success: true as const, suggestions: [] as string[] };
    }
    await this.ensureIndex('all');
    const suggestions = await this.engine.autocomplete({
      index: this.indexName,
      field: 'name',
      prefix,
      limit: Math.min(Math.max(input.limit ?? 8, 1), 20),
    });
    return {
      success: true as const,
      suggestions: suggestions.map((s) => s.text),
      items: suggestions.map((s) => ({ text: s.text, score: s.score })),
    };
  }

  private kindForScope(scope: SearchScope): string {
    switch (scope) {
      case 'restaurants':
        return 'restaurant';
      case 'markets':
        return 'market';
      case 'liquor':
        return 'liquor';
      case 'gas':
        return 'gas';
      case 'products':
        return 'product';
      case 'events':
        return 'event';
      case 'merchants':
        return 'merchant';
      case 'transport':
        return 'transport';
      case 'parcels':
        return 'parcel';
      default:
        return 'merchant';
    }
  }

  private async ensureIndex(scope: SearchScope): Promise<void> {
    if (this.indexer?.isWarm()) {
      return;
    }
    if (this.indexer) {
      await this.indexer.reindexAll();
      return;
    }
    await this.reindexLegacy(scope);
  }

  /** Fallback when SearchIndexerService is not injected (unit tests). */
  private async reindexLegacy(scope: SearchScope): Promise<void> {
    await this.fallbackEngine.clear(this.INDEX);
    const docs: IndexedSearchDoc[] = [];

    const storeScopes: SearchScope[] = [
      'all',
      'restaurants',
      'markets',
      'liquor',
      'gas',
      'merchants',
    ];
    if (storeScopes.includes(scope)) {
      const stores = await this.prisma.store.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          merchant: { deletedAt: null, status: 'ACTIVE' },
        },
        take: 300,
        select: {
          id: true,
          name: true,
          description: true,
          storeType: true,
          merchant: { select: { id: true, name: true } },
        },
      });
      for (const store of stores) {
        const kind = STORE_KIND[store.storeType] ?? 'merchant';
        if (
          scope !== 'all' &&
          scope !== 'merchants' &&
          this.kindForScope(scope) !== kind
        ) {
          continue;
        }
        docs.push({
          id: store.id,
          kind: scope === 'merchants' ? 'merchant' : kind,
          name: store.name,
          description: store.description,
          subtitle: store.merchant.name,
        });
      }
    }

    if (scope === 'all' || scope === 'products') {
      const products = await this.prisma.product.findMany({
        where: { deletedAt: null, isActive: true },
        take: 400,
        select: { id: true, name: true, description: true },
      });
      for (const product of products) {
        docs.push({
          id: product.id,
          kind: 'product',
          name: product.name,
          description: product.description,
        });
      }
    }

    if (scope === 'all' || scope === 'events') {
      const events = await this.prisma.event.findMany({
        where: { deletedAt: null },
        take: 200,
        select: { id: true, name: true, description: true, venue: true },
      });
      for (const event of events) {
        docs.push({
          id: event.id,
          kind: 'event',
          name: event.name,
          description: event.description,
          subtitle: event.venue,
        });
      }
    }

    if (scope === 'all' || scope === 'transport' || scope === 'parcels') {
      const partners = await this.prisma.courierPartner.findMany({
        where: { deletedAt: null, isActive: true },
        take: 100,
        select: { id: true, name: true },
      });
      for (const partner of partners) {
        docs.push({
          id: partner.id,
          kind: scope === 'parcels' ? 'parcel' : 'transport',
          name: partner.name,
          subtitle: 'Courier partner',
        });
      }
      if (scope !== 'parcels') {
        const routes = await this.prisma.interCountyRoute.findMany({
          where: { deletedAt: null, isActive: true },
          take: 100,
          select: { id: true, label: true },
        });
        for (const route of routes) {
          docs.push({
            id: route.id,
            kind: 'transport',
            name: route.label,
            subtitle: 'Inter-county route',
          });
        }
      }
    }

    if (docs.length > 0) {
      await this.fallbackEngine.index(this.INDEX, docs);
    }
  }
}
