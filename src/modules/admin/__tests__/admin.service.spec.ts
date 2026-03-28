import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AdminService } from '../admin.service';
import { PaymentSession } from '../../payments/entities/payment-session.entity';
import { MerchantProfile } from '../../merchants/entities/merchant-profile.entity';
import { User } from '../../users/entities/user.entity';
import { PaymentStatus } from '../../payments/enums/payment-status.enum';

describe('AdminService', () => {
  let service: AdminService;
  let paymentRepository: Repository<PaymentSession>;
  let merchantRepository: Repository<MerchantProfile>;
  let userRepository: Repository<User>;

  const createMockQueryBuilder = () => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
    getCount: jest.fn(),
  });

  const mockPaymentRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockMerchantRepository = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockUserRepository = {
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
  };

  const mockDataSource = {};

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(PaymentSession),
          useValue: mockPaymentRepository,
        },
        {
          provide: getRepositoryToken(MerchantProfile),
          useValue: mockMerchantRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    paymentRepository = module.get<Repository<PaymentSession>>(getRepositoryToken(PaymentSession));
    merchantRepository = module.get<Repository<MerchantProfile>>(getRepositoryToken(MerchantProfile));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardStats()', () => {
    it('should return dashboard statistics', async () => {
      mockMerchantRepository.count.mockResolvedValue(47);
      mockUserRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(312),
      });

      // First query builder call (today's stats)
      mockPaymentRepository.createQueryBuilder.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ revenue: '48200', transactions: '23' }),
      });

      // Second query builder call (7 days stats)
      mockPaymentRepository.createQueryBuilder.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ completed: '94', failed: '6', total: '100' }),
      });

      const stats = await service.getDashboardStats();

      expect(stats).toEqual({
        totalMerchants: 47,
        totalUsers: 312,
        revenueToday: 48200,
        successRate: 94.0,
        transactionsToday: 23,
      });
    });

    it('should return zero values when no data exists', async () => {
      mockMerchantRepository.count.mockResolvedValue(0);
      mockUserRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      });

      mockPaymentRepository.createQueryBuilder
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ revenue: null, transactions: null }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          setParameter: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ completed: null, failed: null, total: null }),
        });

      const stats = await service.getDashboardStats();

      expect(stats).toEqual({
        totalMerchants: 0,
        totalUsers: 0,
        revenueToday: 0,
        successRate: 0,
        transactionsToday: 0,
      });
    });
  });

  describe('getRecentPayments()', () => {
    it('should return recent payments with default limit of 5', async () => {
      const mockPayments = [
        {
          merchant_business_name: 'Mama Mboga Stall',
          payment_amount: '500',
          payment_status: 'COMPLETED',
          payment_created_at: new Date('2026-03-16T14:22:00'),
        },
        {
          merchant_business_name: 'TechHub Nairobi',
          payment_amount: '2000',
          payment_status: 'COMPLETED',
          payment_created_at: new Date('2026-03-16T13:10:00'),
        },
      ];

      mockPaymentRepository.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockPayments),
      });

      const payments = await service.getRecentPayments();

      expect(payments).toHaveLength(2);
      expect(payments[0]).toEqual({
        merchant: 'Mama Mboga Stall',
        amount: 500,
        status: 'COMPLETED',
        date: expect.stringMatching(/^\d{2} \w{3} \d{2}:\d{2}$/),
      });
    });

    it('should respect custom limit parameter', async () => {
      mockPaymentRepository.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      });

      await service.getRecentPayments(10);

      expect(mockPaymentRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('getMerchantOverview()', () => {
    it('should return merchant overview with revenue data', async () => {
      const mockMerchants = [
        {
          merchant_id: '1',
          merchant_business_name: 'Mama Mboga Stall',
          merchant_status: 'ACTIVE',
          merchant_verification_status: 'VERIFIED',
          revenue: '23400',
        },
        {
          merchant_id: '2',
          merchant_business_name: 'TechHub Nairobi',
          merchant_status: 'ACTIVE',
          merchant_verification_status: 'VERIFIED',
          revenue: '156000',
        },
      ];

      mockMerchantRepository.createQueryBuilder.mockReturnValue({
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockMerchants),
      });

      const merchants = await service.getMerchantOverview();

      expect(merchants).toHaveLength(2);
      expect(merchants[0]).toEqual({
        id: 1,
        name: 'Mama Mboga Stall',
        status: 'ACTIVE',
        verified: 'VERIFIED',
        revenue: 23400,
      });
    });

    it('should handle merchants with zero revenue', async () => {
      const mockMerchants = [
        {
          merchant_id: '3',
          merchant_business_name: 'Jua Kali Workshop',
          merchant_status: 'PENDING',
          merchant_verification_status: 'UNVERIFIED',
          revenue: '0',
        },
      ];

      mockMerchantRepository.createQueryBuilder.mockReturnValue({
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockMerchants),
      });

      const merchants = await service.getMerchantOverview();

      expect(merchants[0].revenue).toBe(0);
    });
  });
});
