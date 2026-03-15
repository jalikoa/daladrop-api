import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../audit.service';
import { AuditRepository } from '../repositories/audit.repository';

const mockAuditLog = {
  id: 1,
  user_id: 2,
  action: 'LOGIN',
  ip_address: '1.2.3.4',
  request_method: 'POST',
  endpoint: '/auth/login',
  payload: {},
  created_at: new Date('2026-01-01'),
};

const mockAuditRepo = {
  create: jest.fn(),
  findAll: jest.fn(),
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: AuditRepository, useValue: mockAuditRepo },
      ],
    }).compile();
    service = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('log()', () => {
    it('persists an audit log entry', async () => {
      mockAuditRepo.create.mockResolvedValue(mockAuditLog);
      const result = await service.log({ action: 'LOGIN', user_id: 2, ip_address: '1.2.3.4' });
      expect(result.id).toBe(1);
      expect(result.action).toBe('LOGIN');
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN' }),
      );
    });
  });

  describe('getLogs()', () => {
    it('returns paginated logs', async () => {
      mockAuditRepo.findAll.mockResolvedValue({ data: [mockAuditLog], total: 1 });
      const result = await service.getLogs(1, 20);
      expect(result.total).toBe(1);
      expect(result.data[0].action).toBe('LOGIN');
    });

    it('passes filters to repository', async () => {
      mockAuditRepo.findAll.mockResolvedValue({ data: [], total: 0 });
      await service.getLogs(1, 20, { userId: 2, action: 'LOGIN' });
      expect(mockAuditRepo.findAll).toHaveBeenCalledWith(1, 20, { userId: 2, action: 'LOGIN' });
    });

    it('returns empty list when no logs match', async () => {
      mockAuditRepo.findAll.mockResolvedValue({ data: [], total: 0 });
      const result = await service.getLogs(1, 20, { userId: 9999 });
      expect(result.data).toHaveLength(0);
    });
  });
});