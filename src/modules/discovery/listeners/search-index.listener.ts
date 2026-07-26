import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  SEARCH_ENTITY_KINDS,
  type SearchEntityKind,
} from '../constants/search-index.constants';
import { SearchIndexerService } from '../use-cases/search-indexer.service';

interface EntityIdPayload {
  readonly id?: string;
  readonly storeId?: string;
  readonly productId?: string;
  readonly merchantId?: string;
  readonly categoryId?: string;
  readonly eventId?: string;
  readonly kind?: SearchEntityKind;
}

/**
 * Enqueues search index jobs from domain change events.
 * Never throws back into emitters — indexing is best-effort / durable via queue.
 */
@Injectable()
export class SearchIndexListener {
  private readonly logger = new Logger(SearchIndexListener.name);

  public constructor(private readonly indexer: SearchIndexerService) {}

  @OnEvent('pricing.QuoteGenerated')
  public onQuoteGenerated(): void {
    // Quotes are not searchable catalog entities.
  }

  @OnEvent('search.index.requested')
  public async onIndexRequested(event: EntityIdPayload): Promise<void> {
    const kind = event.kind;
    const id =
      event.id ??
      event.productId ??
      event.storeId ??
      event.merchantId ??
      event.categoryId ??
      event.eventId;
    if (!kind || !id) return;
    if (!(SEARCH_ENTITY_KINDS as readonly string[]).includes(kind)) return;
    await this.safeEnqueue('index', kind, id);
  }

  @OnEvent('merchants.store.created')
  @OnEvent('merchants.store.updated')
  public async onStoreUpsert(event: EntityIdPayload): Promise<void> {
    const id = event.storeId ?? event.id;
    if (id) await this.safeEnqueue('index', 'store', id);
  }

  @OnEvent('merchants.store.deleted')
  public async onStoreDeleted(event: EntityIdPayload): Promise<void> {
    const id = event.storeId ?? event.id;
    if (id) await this.safeEnqueue('remove', 'store', id);
  }

  @OnEvent('merchants.merchant.created')
  @OnEvent('merchants.merchant.updated')
  public async onMerchantUpsert(event: EntityIdPayload): Promise<void> {
    const id = event.merchantId ?? event.id;
    if (id) await this.safeEnqueue('index', 'merchant', id);
  }

  @OnEvent('merchants.merchant.deleted')
  public async onMerchantDeleted(event: EntityIdPayload): Promise<void> {
    const id = event.merchantId ?? event.id;
    if (id) await this.safeEnqueue('remove', 'merchant', id);
  }

  @OnEvent('catalog.product.created')
  @OnEvent('catalog.product.updated')
  public async onProductUpsert(event: EntityIdPayload): Promise<void> {
    const id = event.productId ?? event.id;
    if (id) await this.safeEnqueue('index', 'product', id);
  }

  @OnEvent('catalog.product.deleted')
  public async onProductDeleted(event: EntityIdPayload): Promise<void> {
    const id = event.productId ?? event.id;
    if (id) await this.safeEnqueue('remove', 'product', id);
  }

  @OnEvent('catalog.module_category.created')
  @OnEvent('catalog.module_category.updated')
  public async onCategoryUpsert(event: EntityIdPayload): Promise<void> {
    const id = event.categoryId ?? event.id;
    if (id) await this.safeEnqueue('index', 'category', id);
  }

  @OnEvent('catalog.module_category.deleted')
  public async onCategoryDeleted(event: EntityIdPayload): Promise<void> {
    const id = event.categoryId ?? event.id;
    if (id) await this.safeEnqueue('remove', 'category', id);
  }

  @OnEvent('events.event.created')
  @OnEvent('events.event.updated')
  @OnEvent('events.event.published')
  public async onEventUpsert(event: EntityIdPayload): Promise<void> {
    const id = event.eventId ?? event.id;
    if (id) await this.safeEnqueue('index', 'event', id);
  }

  @OnEvent('events.event.deleted')
  public async onEventDeleted(event: EntityIdPayload): Promise<void> {
    const id = event.eventId ?? event.id;
    if (id) await this.safeEnqueue('remove', 'event', id);
  }

  @OnEvent('events.category.created')
  @OnEvent('events.category.updated')
  public async onEventCategoryUpsert(event: EntityIdPayload): Promise<void> {
    const id = event.categoryId ?? event.id;
    if (id) await this.safeEnqueue('index', 'category', id);
  }

  @OnEvent('events.category.deleted')
  public async onEventCategoryDeleted(event: EntityIdPayload): Promise<void> {
    const id = event.categoryId ?? event.id;
    if (id) await this.safeEnqueue('remove', 'category', id);
  }

  private async safeEnqueue(
    name: 'index' | 'remove',
    kind: SearchEntityKind,
    id: string,
  ): Promise<void> {
    try {
      await this.indexer.enqueue(name, { kind, id }, `${name}:${kind}:${id}`);
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue search ${name} for ${kind}/${id}: ${(error as Error).message}`,
      );
    }
  }
}
