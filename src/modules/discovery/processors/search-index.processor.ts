import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  SEARCH_ENTITY_KINDS,
  SEARCH_INDEX_QUEUE,
  type SearchEntityKind,
  type SearchIndexJobName,
} from '../constants/search-index.constants';
import { SearchIndexerService } from '../use-cases/search-indexer.service';

interface IndexJobData {
  readonly kind: SearchEntityKind;
  readonly id: string;
}

interface ReindexAllJobData {
  readonly kinds?: readonly SearchEntityKind[];
}

/**
 * BullMQ worker for durable search index mutations. Jobs are retry-friendly —
 * index/remove are idempotent; reindex-all rebuilds from Prisma.
 */
@Injectable()
@Processor(SEARCH_INDEX_QUEUE, { concurrency: 2 })
export class SearchIndexProcessor extends WorkerHost {
  private readonly logger = new Logger(SearchIndexProcessor.name);

  public constructor(private readonly indexer: SearchIndexerService) {
    super();
  }

  public async process(
    job: Job<IndexJobData | ReindexAllJobData, void, SearchIndexJobName>,
  ): Promise<void> {
    try {
      switch (job.name) {
        case 'index': {
          const data = job.data as IndexJobData;
          await this.indexer.indexEntity(data.kind, data.id);
          break;
        }
        case 'remove': {
          const data = job.data as IndexJobData;
          await this.indexer.removeEntity(data.kind, data.id);
          break;
        }
        case 'reindex-all': {
          const data = job.data as ReindexAllJobData;
          const kinds = data.kinds?.length
            ? data.kinds.filter((k) =>
                (SEARCH_ENTITY_KINDS as readonly string[]).includes(k),
              )
            : SEARCH_ENTITY_KINDS;
          await this.indexer.reindexBulk(kinds as SearchEntityKind[]);
          break;
        }
        default:
          this.logger.warn(`Unknown search-index job: ${job.name}`);
      }
    } finally {
      this.indexer.markJobSettled();
    }
  }
}
