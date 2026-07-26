import { SearchIndexerService } from '../use-cases/search-indexer.service';

describe('SearchIndexerService.enqueue', () => {
  it('adds an index job with idempotent jobId', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'job-1' });
    const queue = { add } as never;
    const prisma = {} as never;
    const service = new SearchIndexerService(prisma, queue);
    await service.enqueue(
      'index',
      { kind: 'store', id: 's1' },
      'index:store:s1',
    );
    expect(add).toHaveBeenCalledWith(
      'index',
      { kind: 'store', id: 's1' },
      expect.objectContaining({ jobId: 'index:store:s1' }),
    );
  });
});
