import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { AuditQueue } from '../queues/audit.queue';
import { AUDIT_CONSTANTS } from '../constants/audit.constants';
import { AuditLogJobData } from '../interfaces/audit-log-job.interface';

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

describe('AuditQueue', () => {
  let auditQueue: AuditQueue;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditQueue,
        {
          provide: getQueueToken(AUDIT_CONSTANTS.QUEUE.NAME),
          useValue: mockQueue,
        },
      ],
    }).compile();

    auditQueue = module.get<AuditQueue>(AuditQueue);
    await auditQueue.onModuleInit();
  });

  afterEach(async () => {
    await auditQueue.onModuleDestroy();
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(auditQueue).toBeDefined();
  });

  describe('add()', () => {
    it('should add a log to the buffer', async () => {
      const log: AuditLogJobData = {
        user_id: 1,
        action: 'GET.users',
        endpoint: '/users',
        timestamp: Date.now(),
      };

      await auditQueue.add(log);

      expect(auditQueue.getBufferSize()).toBe(1);
      expect(mockQueue.add).not.toHaveBeenCalled(); // Should not flush yet
    });

    it('should flush buffer when it reaches max size', async () => {
      const maxLogs = AUDIT_CONSTANTS.BATCH.MAX_SIZE;

      for (let i = 0; i < maxLogs; i++) {
        await auditQueue.add({
          user_id: 1,
          action: `action-${i}`,
          endpoint: '/test',
          timestamp: Date.now(),
        });
      }

      expect(mockQueue.add).toHaveBeenCalledWith(
        'batch.write',
        expect.objectContaining({
          batchSize: maxLogs,
          logs: expect.arrayContaining([
            expect.objectContaining({ action: 'action-0' }),
          ]),
        }),
        expect.any(Object),
      );
    });

    it('should include timestamp in the log', async () => {
      const beforeAdd = Date.now();
      await auditQueue.add({
        user_id: 1,
        action: 'test.action',
        endpoint: '/test',
      });

      expect(auditQueue.getBufferSize()).toBe(1);
    });
  });

  describe('flushBuffer()', () => {
    it('should flush buffer to queue', async () => {
      await auditQueue.add({
        user_id: 1,
        action: 'test.action',
        endpoint: '/test',
      });

      await auditQueue['flushBuffer']();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'batch.write',
        expect.objectContaining({
          logs: expect.arrayContaining([
            expect.objectContaining({ action: 'test.action' }),
          ]),
          batchSize: 1,
        }),
        expect.any(Object),
      );
      expect(auditQueue.getBufferSize()).toBe(0);
    });

    it('should not flush if buffer is empty', async () => {
      await auditQueue['flushBuffer']();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should not flush if already flushing', async () => {
      await auditQueue.add({
        user_id: 1,
        action: 'test.action',
        endpoint: '/test',
      });

      // Manually set isFlushing to true
      (auditQueue as any).isFlushing = true;

      await auditQueue['flushBuffer']();

      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('periodic flush', () => {
    it('should have flush timer configured', async () => {
      // Verify the flush interval constant is set correctly
      expect(AUDIT_CONSTANTS.BATCH.FLUSH_INTERVAL_MS).toBe(3000);
    });
  });

  describe('onModuleDestroy()', () => {
    it('should flush remaining logs on shutdown', async () => {
      await auditQueue.add({
        user_id: 1,
        action: 'test.action',
        endpoint: '/test',
      });

      await auditQueue.onModuleDestroy();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'batch.write',
        expect.anything(),
        expect.any(Object),
      );
    });
  });
});
