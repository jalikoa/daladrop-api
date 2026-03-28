import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AuditService } from '../audit.service';
import { AuditQueue } from '../queues/audit.queue';
import { AuditRepository } from '../repositories/audit.repository';

const mockAuditQueue = {
  add: jest.fn(),
  getBufferSize: jest.fn().mockReturnValue(0),
};

const mockAuditRepository = {
  findAll: jest.fn(),
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: AuditQueue,
          useValue: mockAuditQueue,
        },
        {
          provide: AuditRepository,
          useValue: mockAuditRepository,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log()', () => {
    it('should add log to queue', async () => {
      const logData = {
        user_id: 1,
        action: 'GET.users',
        endpoint: '/users',
        ip_address: '127.0.0.1',
        request_method: 'GET',
      };

      mockAuditQueue.add.mockResolvedValue(undefined);

      await service.log(logData);

      expect(mockAuditQueue.add).toHaveBeenCalledWith(logData);
    });

    it('should not throw error if queue fails', async () => {
      const logData = {
        user_id: 1,
        action: 'test.action',
        endpoint: '/test',
      };

      mockAuditQueue.add.mockRejectedValue(new Error('Queue error'));

      // Should not throw
      await expect(service.log(logData)).resolves.toBeUndefined();
    });

    it('should log error when queue fails', async () => {
      const logData = {
        user_id: 1,
        action: 'test.action',
        endpoint: '/test',
      };

      mockAuditQueue.add.mockRejectedValue(new Error('Queue error'));

      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      await service.log(logData);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to queue audit log'),
        expect.any(Error),
      );

      loggerSpy.mockRestore();
    });
  });

  describe('getLogs()', () => {
    it('should return paginated audit logs', async () => {
      const mockLogs = { data: [], total: 0 };
      mockAuditRepository.findAll.mockResolvedValue(mockLogs);

      const result = await service.getLogs(1, 20);

      expect(mockAuditRepository.findAll).toHaveBeenCalledWith(1, 20, undefined);
      expect(result).toEqual(mockLogs);
    });

    it('should pass filters to repository', async () => {
      const mockLogs = { data: [], total: 0 };
      mockAuditRepository.findAll.mockResolvedValue(mockLogs);

      await service.getLogs(1, 20, { userId: 1, action: 'GET' });

      expect(mockAuditRepository.findAll).toHaveBeenCalledWith(1, 20, { userId: 1, action: 'GET' });
    });
  });

  describe('getBufferSize()', () => {
    it('should return current buffer size', () => {
      mockAuditQueue.getBufferSize.mockReturnValue(5);

      const size = service.getBufferSize();

      expect(size).toBe(5);
      expect(mockAuditQueue.getBufferSize).toHaveBeenCalled();
    });
  });
});
