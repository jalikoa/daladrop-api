import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { LedgerController } from '../ledger.controller';
import { LedgerService } from '../ledger.service';
import { LedgerRepository } from '../repositories/ledger.repository';
import { QueuesController } from '../../queues/queues.controller';
import { QueuesService,QUEUE_NAMES } from '../../queues/queues.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

const allowAll = { canActivate: () => true };

// ─── LedgerController ─────────────────────────────────────────────────────────
describe('LedgerController', () => {
  let controller: LedgerController;

  const mockLedgerService = {
    record: jest.fn(),
    getBalance: jest.fn(),
  };

  const mockLedgerRepo = {
    findEntriesByAccount: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LedgerController],
      providers: [
        { provide: LedgerService, useValue: mockLedgerService },
        { provide: LedgerRepository, useValue: mockLedgerRepo },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(allowAll)
      .overrideGuard(RolesGuard).useValue(allowAll)
      .compile();
    controller = module.get<LedgerController>(LedgerController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  describe('GET /ledger/accounts/:id/balance', () => {
    it('returns account_id and balance string', async () => {
      mockLedgerService.getBalance.mockResolvedValue('1500.00');
      const result = await controller.getBalance('acc-1001');
      expect(result.account_id).toBe('acc-1001');
      expect(result.balance).toBe('1500.00');
    });

    it('returns 0.00 for account with no entries', async () => {
      mockLedgerService.getBalance.mockResolvedValue('0.00');
      const result = await controller.getBalance('acc-new');
      expect(result.balance).toBe('0.00');
    });
  });

  describe('POST /ledger/entries', () => {
    const balancedEntries = [
      { accountId: 'acc-1001', type: 'debit' as const, amount: '500.00' },
      { accountId: 'acc-2001', type: 'credit' as const, amount: '500.00' },
    ];

    it('records entries and returns count and entries array', async () => {
      const saved = balancedEntries.map((e, i) => ({ ...e, id: String(i + 1) }));
      mockLedgerService.record.mockResolvedValue(saved);

      const result = await controller.recordEntries({
        transaction_id: 'tx-001',
        entries: balancedEntries,
      });

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.entries).toHaveLength(2);
      expect(mockLedgerService.record).toHaveBeenCalledWith('tx-001', balancedEntries);
    });

    it('throws BadRequestException when transaction_id is missing', async () => {
      await expect(
        controller.recordEntries({ transaction_id: '', entries: balancedEntries }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when entries array is empty', async () => {
      await expect(
        controller.recordEntries({ transaction_id: 'tx-001', entries: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('propagates UnprocessableEntityException for unbalanced entries from service', async () => {
      mockLedgerService.record.mockRejectedValue(
        new UnprocessableEntityException('Ledger entries are unbalanced'),
      );
      await expect(
        controller.recordEntries({
          transaction_id: 'tx-bad',
          entries: [
            { accountId: 'acc-1001', type: 'debit', amount: '500.00' },
            { accountId: 'acc-2001', type: 'credit', amount: '300.00' },
          ],
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('GET /ledger/entries', () => {
    it('returns entries for a given account_id', async () => {
      const mockEntries = [{ id: '1', accountId: 'acc-1001', type: 'debit', amount: '500.00' }];
      mockLedgerRepo.findEntriesByAccount.mockResolvedValue(mockEntries);

      const result = await controller.getEntries('acc-1001', 50, 0);
      expect(result.account_id).toBe('acc-1001');
      expect(result.count).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('passes limit and offset to repository', async () => {
      mockLedgerRepo.findEntriesByAccount.mockResolvedValue([]);
      await controller.getEntries('acc-1001', 20, 40);
      expect(mockLedgerRepo.findEntriesByAccount).toHaveBeenCalledWith('acc-1001', 20, 40);
    });
  });
});

// ─── QueuesController ─────────────────────────────────────────────────────────
describe('QueuesController', () => {
  let controller: QueuesController;

  const mockQueuesService = {
    getAllStatuses: jest.fn(),
    getQueueStatus: jest.fn(),
    getJobs: jest.fn(),
    getJob: jest.fn(),
    retryJob: jest.fn(),
    removeJob: jest.fn(),
    cleanQueue: jest.fn(),
    pauseQueue: jest.fn(),
    resumeQueue: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueuesController],
      providers: [{ provide: QueuesService, useValue: mockQueuesService }],
    })
      .overrideGuard(JwtAuthGuard).useValue(allowAll)
      .overrideGuard(RolesGuard).useValue(allowAll)
      .compile();
    controller = module.get<QueuesController>(QueuesController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  describe('GET /queues', () => {
    it('returns status for all queues', async () => {
      const statuses = [
        { name: QUEUE_NAMES.PDF, waiting: 0, active: 1, completed: 50, failed: 2, delayed: 0, paused: false },
      ];
      mockQueuesService.getAllStatuses.mockResolvedValue(statuses);
      const result = await controller.getAll();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe(QUEUE_NAMES.PDF);
    });
  });

  describe('GET /queues/:name', () => {
    it('returns status for a named queue', async () => {
      const status = { name: QUEUE_NAMES.PDF, waiting: 3, active: 0, completed: 10, failed: 1, delayed: 0, paused: false };
      mockQueuesService.getQueueStatus.mockResolvedValue(status);
      const result = await controller.getQueue(QUEUE_NAMES.PDF);
      expect(result.waiting).toBe(3);
    });

    it('propagates NotFoundException for unknown queue name', async () => {
      mockQueuesService.getQueueStatus.mockRejectedValue(new NotFoundException('Queue not found'));
      await expect(controller.getQueue('ghost-queue')).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /queues/:name/jobs', () => {
    it('returns list of jobs in given state', async () => {
      const jobs = [{ id: 'j1', name: 'merchant.card.generate', status: 'failed', data: {}, attemptsMade: 3, timestamp: Date.now() }];
      mockQueuesService.getJobs.mockResolvedValue(jobs);
      const result = await controller.getJobs(QUEUE_NAMES.PDF, 'failed', 0, 20);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('j1');
    });
  });

  describe('GET /queues/:name/jobs/:id', () => {
    it('returns a single job detail', async () => {
      const job = { id: 'j1', name: 'pdf.generate', status: 'failed', data: {}, attemptsMade: 1, timestamp: Date.now() };
      mockQueuesService.getJob.mockResolvedValue(job);
      const result = await controller.getJob(QUEUE_NAMES.PDF, 'j1');
      expect(result.id).toBe('j1');
    });
  });

  describe('POST /queues/:name/jobs/:id/retry', () => {
    it('retries a failed job', async () => {
      mockQueuesService.retryJob.mockResolvedValue({ success: true, jobId: 'j1' });
      const result = await controller.retryJob(QUEUE_NAMES.PDF, 'j1');
      expect(result.success).toBe(true);
    });
  });

  describe('DELETE /queues/:name/jobs/:id', () => {
    it('removes a job permanently', async () => {
      mockQueuesService.removeJob.mockResolvedValue({ success: true });
      const result = await controller.removeJob(QUEUE_NAMES.PDF, 'j1');
      expect(result.success).toBe(true);
    });
  });

  describe('POST /queues/:name/clean', () => {
    it('cleans completed jobs and returns removed count', async () => {
      mockQueuesService.cleanQueue.mockResolvedValue({ removed: 15 });
      const result = await controller.cleanQueue(QUEUE_NAMES.PDF, 'completed');
      expect(result.removed).toBe(15);
    });
  });

  describe('POST /queues/:name/pause', () => {
    it('pauses the queue', async () => {
      mockQueuesService.pauseQueue.mockResolvedValue({ paused: true });
      const result = await controller.pauseQueue(QUEUE_NAMES.PDF);
      expect(result.paused).toBe(true);
    });
  });

  describe('POST /queues/:name/resume', () => {
    it('resumes the queue', async () => {
      mockQueuesService.resumeQueue.mockResolvedValue({ resumed: true });
      const result = await controller.resumeQueue(QUEUE_NAMES.PDF);
      expect(result.resumed).toBe(true);
    });
  });
});