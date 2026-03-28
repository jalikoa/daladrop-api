import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from '../admin.controller';
import { AdminService } from '../admin.service';

const mockAdminService = {
  getDashboardStats: jest.fn(),
  getRecentPayments: jest.fn(),
  getMerchantOverview: jest.fn(),
};

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboardStats()', () => {
    it('should return dashboard statistics', async () => {
      const mockStats = {
        totalMerchants: 47,
        totalUsers: 312,
        revenueToday: 48200,
        successRate: 94.2,
        transactionsToday: 23,
      };
      mockAdminService.getDashboardStats.mockResolvedValue(mockStats);

      const result = await controller.getDashboardStats();

      expect(result).toEqual(mockStats);
      expect(mockAdminService.getDashboardStats).toHaveBeenCalled();
    });
  });

  describe('getRecentPayments()', () => {
    it('should return recent payments with default limit', async () => {
      const mockPayments = [
        { merchant: 'Test Merchant', amount: 500, status: 'COMPLETED', date: '16 Mar 14:22' },
      ];
      mockAdminService.getRecentPayments.mockResolvedValue(mockPayments);

      const result = await controller.getRecentPayments();

      expect(result).toEqual(mockPayments);
      expect(mockAdminService.getRecentPayments).toHaveBeenCalledWith(5);
    });

    it('should accept custom limit parameter', async () => {
      const mockPayments = [
        { merchant: 'Test Merchant', amount: 500, status: 'COMPLETED', date: '16 Mar 14:22' },
      ];
      mockAdminService.getRecentPayments.mockResolvedValue(mockPayments);

      await controller.getRecentPayments(10);

      expect(mockAdminService.getRecentPayments).toHaveBeenCalledWith(10);
    });
  });

  describe('getMerchantOverview()', () => {
    it('should return merchant overview', async () => {
      const mockMerchants = [
        { id: 1, name: 'Test Merchant', status: 'ACTIVE', verified: 'VERIFIED', revenue: 23400 },
      ];
      mockAdminService.getMerchantOverview.mockResolvedValue(mockMerchants);

      const result = await controller.getMerchantOverview();

      expect(result).toEqual(mockMerchants);
      expect(mockAdminService.getMerchantOverview).toHaveBeenCalled();
    });
  });
});
