import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { QueuesService, QUEUE_NAMES } from '../queues.service';

// ─── Queue mock factory ────────────────────────────────────────────────────────
const makeQueueMock = (name: string) => ({
  name,
  getWaitingCount: jest.fn().mockResolvedValue(0),
  getActiveCount: jest.fn().mockResolvedValue(0),
  getCompletedCount: jest.fn().mockResolvedValue(0),
  getFailedCount: jest.fn().mockResolvedValue(0),
  getDelayedCount: jest.fn().mockResolvedValue(0),
  isPaused: jest.fn().mockResolvedValue(false),
  getJobs: jest.fn().mockResolvedValue([]),
  getJob: jest.fn(),
  clean: jest.fn().mockResolvedValue([]),
  pause: jest.fn().mockResolvedValue(undefined),
  resume: jest.fn().mockResolvedValue(undefined),
});

const mockFailedJob = {
  id: 'job-1',
  name: 'merchant.card.generate',
  data: { merchantId: 1 },
  failedReason: 'Timeout',
  attemptsMade: 3,
  timestamp: Date.now(),
  processedOn: undefined,
  finishedOn: undefined,
  getState: jest.fn().mockResolvedValue('failed'),
  retry: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
};

describe('QueuesService', () => {
  let service: QueuesService;
  let ledgerQueue: ReturnType<typeof makeQueueMock>;
  let pdfQueue: ReturnType<typeof makeQueueMock>;
  let pdfReportQueue: ReturnType<typeof makeQueueMock>;

  beforeEach(async () => {
    jest.clearAllMocks();
    ledgerQueue = makeQueueMock(QUEUE_NAMES.LEDGER);
    pdfQueue = makeQueueMock(QUEUE_NAMES.PDF);
    pdfReportQueue = makeQueueMock(QUEUE_NAMES.PDF_REPORT);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueuesService,
        { provide: getQueueToken(QUEUE_NAMES.LEDGER), useValue: ledgerQueue },
        { provide: getQueueToken(QUEUE_NAMES.PDF), useValue: pdfQueue },
        { provide: getQueueToken(QUEUE_NAMES.PDF_REPORT), useValue: pdfReportQueue },
      ],
    }).compile();
    service = module.get<QueuesService>(QueuesService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('getAllStatuses()', () => {
    it('returns status for all three queues', async () => {
      const result = await service.getAllStatuses();
      expect(result).toHaveLength(3);
      expect(result.map(q => q.name)).toEqual(
        expect.arrayContaining([QUEUE_NAMES.LEDGER, QUEUE_NAMES.PDF, QUEUE_NAMES.PDF_REPORT]),
      );
    });

    it('includes correct count fields', async () => {
      ledgerQueue.getWaitingCount.mockResolvedValue(3);
      ledgerQueue.getFailedCount.mockResolvedValue(1);
      const result = await service.getAllStatuses();
      const ledgerStatus = result.find(q => q.name === QUEUE_NAMES.LEDGER);
      expect(ledgerStatus?.waiting).toBe(3);
      expect(ledgerStatus?.failed).toBe(1);
    });

    it('reflects paused state', async () => {
      pdfQueue.isPaused.mockResolvedValue(true);
      const result = await service.getAllStatuses();
      const pdfStatus = result.find(q => q.name === QUEUE_NAMES.PDF);
      expect(pdfStatus?.paused).toBe(true);
    });
  });

  describe('getQueueStatus()', () => {
    it('returns status for a specific queue', async () => {
      const result = await service.getQueueStatus(QUEUE_NAMES.PDF);
      expect(result.name).toBe(QUEUE_NAMES.PDF);
    });

    it('throws NotFoundException for unknown queue name', async () => {
      await expect(service.getQueueStatus('unknown-queue')).rejects.toThrow(NotFoundException);
    });

    it('NotFoundException message lists available queue names', async () => {
      await expect(service.getQueueStatus('typo-queue')).rejects.toThrow(/ledger-queue|pdf-queue/);
    });
  });

  describe('getJobs()', () => {
    it('returns job summaries for given state', async () => {
      pdfQueue.getJobs.mockResolvedValue([mockFailedJob]);
      const result = await service.getJobs(QUEUE_NAMES.PDF, 'failed');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('job-1');
      expect(result[0].failedReason).toBe('Timeout');
    });

    it('returns empty array when no jobs in state', async () => {
      pdfQueue.getJobs.mockResolvedValue([]);
      const result = await service.getJobs(QUEUE_NAMES.PDF, 'failed');
      expect(result).toHaveLength(0);
    });
  });

  describe('getJob()', () => {
    it('returns job summary for existing job', async () => {
      pdfQueue.getJob.mockResolvedValue(mockFailedJob);
      const result = await service.getJob(QUEUE_NAMES.PDF, 'job-1');
      expect(result.id).toBe('job-1');
      expect(result.name).toBe('merchant.card.generate');
    });

    it('throws NotFoundException when job does not exist', async () => {
      pdfQueue.getJob.mockResolvedValue(null);
      await expect(service.getJob(QUEUE_NAMES.PDF, 'missing-job')).rejects.toThrow(NotFoundException);
    });
  });

  describe('retryJob()', () => {
    it('calls job.retry() and returns success', async () => {
      pdfQueue.getJob.mockResolvedValue(mockFailedJob);
      const result = await service.retryJob(QUEUE_NAMES.PDF, 'job-1');
      expect(result.success).toBe(true);
      expect(mockFailedJob.retry).toHaveBeenCalled();
    });

    it('throws NotFoundException when retrying a non-existent job', async () => {
      pdfQueue.getJob.mockResolvedValue(null);
      await expect(service.retryJob(QUEUE_NAMES.PDF, 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeJob()', () => {
    it('calls job.remove() and returns success', async () => {
      pdfQueue.getJob.mockResolvedValue(mockFailedJob);
      const result = await service.removeJob(QUEUE_NAMES.PDF, 'job-1');
      expect(result.success).toBe(true);
      expect(mockFailedJob.remove).toHaveBeenCalled();
    });
  });

  describe('cleanQueue()', () => {
    it('returns count of removed jobs', async () => {
      pdfQueue.clean.mockResolvedValue([{}, {}, {}]);
      const result = await service.cleanQueue(QUEUE_NAMES.PDF, 'completed');
      expect(result.removed).toBe(3);
    });

    it('defaults to cleaning completed jobs', async () => {
      pdfQueue.clean.mockResolvedValue([]);
      await service.cleanQueue(QUEUE_NAMES.PDF);
      expect(pdfQueue.clean).toHaveBeenCalledWith(0, 'completed');
    });
  });

  describe('pauseQueue() / resumeQueue()', () => {
    it('pauses a queue', async () => {
      const result = await service.pauseQueue(QUEUE_NAMES.LEDGER);
      expect(result.paused).toBe(true);
      expect(ledgerQueue.pause).toHaveBeenCalled();
    });

    it('resumes a paused queue', async () => {
      const result = await service.resumeQueue(QUEUE_NAMES.LEDGER);
      expect(result.resumed).toBe(true);
      expect(ledgerQueue.resume).toHaveBeenCalled();
    });
  });
});