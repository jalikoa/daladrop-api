import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';
import { QueryNotificationDto } from '../dto/query-notifications.dto';

const mockNotificationsService = {
  getNotifications: jest.fn(),
  sendSms: jest.fn(),
  sendEmail: jest.fn(),
  sendPush: jest.fn(),
};

describe('NotificationsController', () => {
  let controller: NotificationsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getNotifications()', () => {
    const mockNotifications: QueryNotificationDto[] = [
      {
        id: 1,
        userId: 1,
        channel: 'SMS',
        recipient: '+254712345678',
        message: 'Payment received: KES 500',
        priority: 'NORMAL',
        status: 'DELIVERED',
        createdAt: '2026-03-16T14:22:00.000Z',
        deliveredAt: '2026-03-16T14:22:05.000Z',
      },
      {
        id: 2,
        userId: 2,
        channel: 'EMAIL',
        recipient: 'admin@example.com',
        subject: 'New merchant registered',
        message: 'New merchant: Jua Kali Workshop registered',
        priority: 'LOW',
        status: 'DELIVERED',
        createdAt: '2026-03-01T09:00:00.000Z',
        deliveredAt: '2026-03-01T09:00:10.000Z',
      },
    ];

    it('should return paginated notifications with default pagination', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue({
        data: mockNotifications,
        total: 50,
      });

      const result = await controller.getNotifications();

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(50);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(3); // ceil(50/20) = 3
      expect(mockNotificationsService.getNotifications).toHaveBeenCalledWith(1, 20);
    });

    it('should accept custom page and limit parameters', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue({
        data: mockNotifications,
        total: 100,
      });

      const result = await controller.getNotifications(2, 10);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(10);
      expect(mockNotificationsService.getNotifications).toHaveBeenCalledWith(2, 10);
    });

    it('should return empty array when no notifications exist', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await controller.getNotifications();

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should calculate totalPages correctly', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue({
        data: mockNotifications,
        total: 45,
      });

      const result = await controller.getNotifications(1, 10);

      expect(result.totalPages).toBe(5); // ceil(45/10) = 5
    });

    it('should return proper response structure', async () => {
      mockNotificationsService.getNotifications.mockResolvedValue({
        data: mockNotifications,
        total: 2,
      });

      const result = await controller.getNotifications();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('totalPages');
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('sendSms()', () => {
    it('should send SMS notification', async () => {
      mockNotificationsService.sendSms.mockResolvedValue(undefined);

      await controller.sendSms('+254712345678', 'Test message');

      expect(mockNotificationsService.sendSms).toHaveBeenCalledWith(
        '+254712345678',
        'Test message',
      );
    });
  });

  describe('sendEmail()', () => {
    it('should send email notification', async () => {
      mockNotificationsService.sendEmail.mockResolvedValue(undefined);

      await controller.sendEmail('test@example.com', 'Test Subject', 'Test body');

      expect(mockNotificationsService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test Subject',
        'Test body',
      );
    });
  });

  describe('sendPush()', () => {
    it('should send push notification', async () => {
      mockNotificationsService.sendPush.mockResolvedValue(undefined);

      await controller.sendPush('fcm_token_123', 'Test Title', 'Test body');

      expect(mockNotificationsService.sendPush).toHaveBeenCalledWith(
        'fcm_token_123',
        'Test Title',
        'Test body',
      );
    });
  });
});
