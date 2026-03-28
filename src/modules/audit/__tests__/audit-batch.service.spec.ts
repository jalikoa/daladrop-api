import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AuditBatchService } from '../services/audit-batch.service';
import { AuditRepository } from '../repositories/audit.repository';
import { AuditLogJobData } from '../interfaces/audit-log-job.interface';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';

const mockAuditRepository = {
  createBatch: jest.fn(),
};

describe('AuditBatchService', () => {
  let service: AuditBatchService;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditBatchService,
        {
          provide: AuditRepository,
          useValue: mockAuditRepository,
        },
      ],
    }).compile();

    service = module.get<AuditBatchService>(AuditBatchService);
    loggerSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    loggerSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('writeBatch()', () => {
    const sampleLogs: AuditLogJobData[] = [
      {
        user_id: 1,
        action: 'GET.users',
        endpoint: '/users',
        ip_address: '127.0.0.1',
        request_method: 'GET',
        user_agent: 'Mozilla/5.0',
        payload: { query: { page: '1' } },
        response_status: 200,
        timestamp: Date.now(),
      },
      {
        user_id: 2,
        action: 'POST.payments',
        endpoint: '/payments/stk',
        ip_address: '192.168.1.100',
        request_method: 'POST',
        user_agent: 'PostmanRuntime/7.29.0',
        payload: { amount: 500, phone: '0712345678' },
        response_status: 201,
        timestamp: Date.now(),
      },
    ];

    it('should write a batch of audit logs to the database', async () => {
      mockAuditRepository.createBatch.mockResolvedValue([]);

      await service.writeBatch(sampleLogs);

      expect(mockAuditRepository.createBatch).toHaveBeenCalledWith([
        {
          user_id: 1,
          action: 'GET.users',
          endpoint: '/users',
          ip_address: '127.0.0.1',
          request_method: 'GET',
          user_agent: 'Mozilla/5.0',
          payload: { query: { page: '1' } },
          response_status: 200,
        },
        {
          user_id: 2,
          action: 'POST.payments',
          endpoint: '/payments/stk',
          ip_address: '192.168.1.100',
          request_method: 'POST',
          user_agent: 'PostmanRuntime/7.29.0',
          payload: { amount: 500, phone: '0712345678' },
          response_status: 201,
        },
      ]);
    });

    it('should log success message after writing batch', async () => {
      mockAuditRepository.createBatch.mockResolvedValue([]);

      await service.writeBatch(sampleLogs);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully wrote 2 audit logs'),
      );
    });

    it('should handle empty batch without calling repository', async () => {
      await service.writeBatch([]);
      expect(mockAuditRepository.createBatch).not.toHaveBeenCalled();
    });

    it('should exclude timestamp from batch data', async () => {
      const logsWithTimestamp: AuditLogJobData[] = [
        {
          user_id: 1,
          action: 'test.action',
          endpoint: '/test',
          timestamp: Date.now(),
        },
      ];

      mockAuditRepository.createBatch.mockResolvedValue([]);

      await service.writeBatch(logsWithTimestamp);

      expect(mockAuditRepository.createBatch).toHaveBeenCalledWith([
        {
          user_id: 1,
          action: 'test.action',
          endpoint: '/test',
        },
      ]);
    });

    it('should include all optional fields when present', async () => {
      const fullLog: AuditLogJobData[] = [
        {
          user_id: 1,
          action: 'DELETE.users',
          endpoint: '/users/123',
          ip_address: '10.0.0.1',
          request_method: 'DELETE',
          user_agent: 'curl/7.68.0',
          payload: { hardDelete: true },
          response_status: 204,
          timestamp: Date.now(),
        },
      ];

      mockAuditRepository.createBatch.mockResolvedValue([]);

      await service.writeBatch(fullLog);

      expect(mockAuditRepository.createBatch).toHaveBeenCalledWith([
        {
          user_id: 1,
          action: 'DELETE.users',
          endpoint: '/users/123',
          ip_address: '10.0.0.1',
          request_method: 'DELETE',
          user_agent: 'curl/7.68.0',
          payload: { hardDelete: true },
          response_status: 204,
        },
      ]);
    });

    it('should handle logs without optional fields', async () => {
      const minimalLog: AuditLogJobData[] = [
        {
          action: 'GET.health',
          endpoint: '/health',
          timestamp: Date.now(),
        },
      ];

      mockAuditRepository.createBatch.mockResolvedValue([]);

      await service.writeBatch(minimalLog);

      expect(mockAuditRepository.createBatch).toHaveBeenCalledWith([
        {
          action: 'GET.health',
          endpoint: '/health',
        },
      ]);
    });

    it('should throw error if repository fails', async () => {
      const errorMessage = 'Database connection lost';
      mockAuditRepository.createBatch.mockRejectedValue(new Error(errorMessage));

      await expect(service.writeBatch(sampleLogs)).rejects.toThrow(errorMessage);
    });

    it('should log error message when repository fails', async () => {
      const errorLoggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      mockAuditRepository.createBatch.mockRejectedValue(new Error('Database error'));

      try {
        await service.writeBatch(sampleLogs);
      } catch (e) {
        // Expected to throw
      }

      expect(errorLoggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to write batch of 2 audit logs'),
        expect.any(Error),
      );

      errorLoggerSpy.mockRestore();
    });

    it('should handle large batches', async () => {
      const largeBatch: AuditLogJobData[] = Array.from({ length: 100 }, (_, i) => ({
        user_id: i + 1,
        action: `action-${i}`,
        endpoint: `/endpoint-${i}`,
        timestamp: Date.now(),
      }));

      mockAuditRepository.createBatch.mockResolvedValue([]);

      await service.writeBatch(largeBatch);

      expect(mockAuditRepository.createBatch).toHaveBeenCalledTimes(1);
      expect(mockAuditRepository.createBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ action: 'action-0' }),
          expect.objectContaining({ action: 'action-99' }),
        ]),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully wrote 100 audit logs'),
      );
    });

    it('should preserve payload structure', async () => {
      const logWithComplexPayload: AuditLogJobData[] = [
        {
          user_id: 1,
          action: 'POST.complex',
          endpoint: '/api/complex',
          payload: {
            nested: {
              data: {
                items: [1, 2, 3],
                metadata: { key: 'value' },
              },
            },
            array: ['a', 'b', 'c'],
            boolean: true,
            number: 42,
          },
          timestamp: Date.now(),
        },
      ];

      mockAuditRepository.createBatch.mockResolvedValue([]);

      await service.writeBatch(logWithComplexPayload);

      expect(mockAuditRepository.createBatch).toHaveBeenCalledWith([
        expect.objectContaining({
          payload: {
            nested: {
              data: {
                items: [1, 2, 3],
                metadata: { key: 'value' },
              },
            },
            array: ['a', 'b', 'c'],
            boolean: true,
            number: 42,
          },
        }),
      ]);
    });

    it('should handle null user_id', async () => {
      const anonymousLog: AuditLogJobData[] = [
        {
          action: 'GET.public',
          endpoint: '/public/data',
          timestamp: Date.now(),
        },
      ];

      mockAuditRepository.createBatch.mockResolvedValue([]);

      await service.writeBatch(anonymousLog);

      const calledWith = (mockAuditRepository.createBatch as jest.Mock).mock.calls[0][0];
      expect(calledWith[0].user_id).toBeUndefined();
    });

    it('should handle various HTTP methods', async () => {
      const variousMethods: AuditLogJobData[] = [
        { action: 'GET.test', request_method: 'GET', endpoint: '/test', timestamp: Date.now() },
        { action: 'POST.test', request_method: 'POST', endpoint: '/test', timestamp: Date.now() },
        { action: 'PUT.test', request_method: 'PUT', endpoint: '/test', timestamp: Date.now() },
        { action: 'PATCH.test', request_method: 'PATCH', endpoint: '/test', timestamp: Date.now() },
        { action: 'DELETE.test', request_method: 'DELETE', endpoint: '/test', timestamp: Date.now() },
      ];

      mockAuditRepository.createBatch.mockResolvedValue([]);

      await service.writeBatch(variousMethods);

      expect(mockAuditRepository.createBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ request_method: 'GET' }),
          expect.objectContaining({ request_method: 'POST' }),
          expect.objectContaining({ request_method: 'PUT' }),
          expect.objectContaining({ request_method: 'PATCH' }),
          expect.objectContaining({ request_method: 'DELETE' }),
        ]),
      );
    });
  });
});
