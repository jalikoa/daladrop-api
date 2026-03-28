import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { NotificationsService } from '../notifications.service';
import { NotificationsRepository } from '../repositories/notifications.repository';
import { NotificationMapper } from '../mappers/notification.mapper';
import { Notification } from '../entities/notification.entity';
import { NotificationChannel, NotificationStatus, NotificationPriority } from '../enums/notification-channel.enum';
import { NOTIFICATION_CONSTANTS } from '../constants/notification.constants';
import { QueryNotificationDto } from '../dto/query-notifications.dto';
import { SendNotificationUseCase } from '../use-cases/send-notification.usecase';

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

const mockNotification: Notification = {
  id: 1,
  user_id: 1,
  user: null,
  channel: NotificationChannel.SMS,
  recipient: '+254712345678',
  message: 'Payment received: KES 500',
  subject: null,
  status: NotificationStatus.DELIVERED,
  priority: NotificationPriority.NORMAL,
  provider: 'AfricaTalking',
  provider_message_id: 'msg-123',
  error_message: null,
  retry_count: 0,
  meta: null,
  template_data: null,
  template_name: null,
  created_at: new Date('2026-03-16T14:22:00Z'),
  updated_at: new Date('2026-03-16T14:22:05Z'),
  sent_at: new Date('2026-03-16T14:22:05Z'),
  delivered_at: new Date('2026-03-16T14:22:05Z'),
  failed_at: null,
  toJSON: function () {
    const { user, ...values } = { ...this };
    return values;
  },
  canRetry: jest.fn(),
  markSent: jest.fn(),
  markDelivered: jest.fn(),
  markFailed: jest.fn(),
  markCancelled: jest.fn(),
};

const mockNotificationsRepository = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findByUserId: jest.fn(),
  findByStatus: jest.fn(),
};

const mockNotificationMapper = {
  toDto: jest.fn(),
  toMany: jest.fn(),
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getQueueToken(NOTIFICATION_CONSTANTS.QUEUE.NAME),
          useValue: mockQueue,
        },
        {
          provide: NotificationsRepository,
          useValue: mockNotificationsRepository,
        },
        {
          provide: NotificationMapper,
          useValue: mockNotificationMapper,
        },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendSms()', () => {
    it('enqueues an SMS job', async () => {
      await service.sendSms('+254712345678', 'Your payment was received.');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send.sms',
        { phone: '+254712345678', message: 'Your payment was received.' },
      );
    });
  });

  describe('sendEmail()', () => {
    it('enqueues an email job', async () => {
      await service.sendEmail('alice@example.com', 'Payment Received', '<p>KES 500 received</p>');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send.email',
        { email: 'alice@example.com', subject: 'Payment Received', body: '<p>KES 500 received</p>' },
      );
    });
  });

  describe('sendPush()', () => {
    it('enqueues a push notification job', async () => {
      await service.sendPush('fcm_token_abc', 'Payment Confirmed', 'KES 500 received');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send.push',
        { token: 'fcm_token_abc', title: 'Payment Confirmed', body: 'KES 500 received' },
      );
    });
  });

  describe('queueNotification()', () => {
    it('enqueues with correct job name for SMS', async () => {
      await service.queueNotification(NotificationChannel.SMS, { phone: '+254712345678' });
      expect(mockQueue.add).toHaveBeenCalledWith('send.sms', { phone: '+254712345678' });
    });

    it('enqueues with correct job name for EMAIL', async () => {
      await service.queueNotification(NotificationChannel.EMAIL, { email: 'a@b.com' });
      expect(mockQueue.add).toHaveBeenCalledWith('send.email', { email: 'a@b.com' });
    });

    it('enqueues with correct job name for PUSH', async () => {
      await service.queueNotification(NotificationChannel.PUSH, { token: 'fcm' });
      expect(mockQueue.add).toHaveBeenCalledWith('send.push', { token: 'fcm' });
    });
  });

  describe('getNotifications()', () => {
    it('should return paginated notifications with default pagination', async () => {
      const mockNotificationsArray = [mockNotification];
      const mockDto: QueryNotificationDto = {
        id: 1,
        userId: 1,
        channel: 'SMS',
        recipient: '+254712345678',
        message: 'Payment received: KES 500',
        priority: 'NORMAL',
        status: 'DELIVERED',
        createdAt: '2026-03-16T14:22:00.000Z',
        deliveredAt: '2026-03-16T14:22:05.000Z',
      };

      mockNotificationsRepository.findAll.mockResolvedValue({
        data: mockNotificationsArray,
        total: 50,
      });

      mockNotificationMapper.toMany.mockReturnValue([mockDto]);

      const result = await service.getNotifications();

      expect(mockNotificationsRepository.findAll).toHaveBeenCalledWith(1, 20);
      expect(result).toEqual({
        data: [mockDto],
        total: 50,
      });
    });

    it('should return paginated notifications with custom pagination', async () => {
      const mockNotificationsArray = [mockNotification, mockNotification];
      const mockDto: QueryNotificationDto = {
        id: 1,
        userId: 1,
        channel: 'SMS',
        recipient: '+254712345678',
        message: 'Payment received: KES 500',
        priority: 'NORMAL',
        status: 'DELIVERED',
        createdAt: '2026-03-16T14:22:00.000Z',
        deliveredAt: '2026-03-16T14:22:05.000Z',
      };

      mockNotificationsRepository.findAll.mockResolvedValue({
        data: mockNotificationsArray,
        total: 100,
      });

      mockNotificationMapper.toMany.mockReturnValue([mockDto, mockDto]);

      const result = await service.getNotifications(2, 10);

      expect(mockNotificationsRepository.findAll).toHaveBeenCalledWith(2, 10);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(100);
    });

    it('should return empty array when no notifications exist', async () => {
      mockNotificationsRepository.findAll.mockResolvedValue({
        data: [],
        total: 0,
      });

      mockNotificationMapper.toMany.mockReturnValue([]);

      const result = await service.getNotifications();

      expect(result).toEqual({
        data: [],
        total: 0,
      });
    });

    it('should map all notifications to DTOs', async () => {
      const mockNotificationsArray = [mockNotification, mockNotification];
      const mockDto: QueryNotificationDto = {
        id: 1,
        userId: 1,
        channel: 'SMS',
        recipient: '+254712345678',
        message: 'Payment received: KES 500',
        priority: 'NORMAL',
        status: 'DELIVERED',
        createdAt: '2026-03-16T14:22:00.000Z',
        deliveredAt: '2026-03-16T14:22:05.000Z',
      };

      mockNotificationsRepository.findAll.mockResolvedValue({
        data: mockNotificationsArray,
        total: 2,
      });

      mockNotificationMapper.toMany.mockReturnValue([mockDto, mockDto]);

      await service.getNotifications();

      expect(mockNotificationMapper.toMany).toHaveBeenCalledTimes(1);
      expect(mockNotificationMapper.toMany).toHaveBeenCalledWith(mockNotificationsArray);
    });
  });
});

// ─── SendNotificationUseCase ──────────────────────────────────────────────────
describe('SendNotificationUseCase', () => {
  let useCase: SendNotificationUseCase;

  const mockSmsProvider = { send: jest.fn() };
  const mockEmailProvider = { send: jest.fn() };
  const mockPushProvider = { sendToDevice: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendNotificationUseCase,
        { provide: 'ISmsProvider', useValue: mockSmsProvider },
        { provide: 'IEmailProvider', useValue: mockEmailProvider },
        { provide: 'IPushProvider', useValue: mockPushProvider },
      ],
    }).compile();
    useCase = module.get<SendNotificationUseCase>(SendNotificationUseCase);
  });

  it('calls SMS provider for SMS channel', async () => {
    mockSmsProvider.send.mockResolvedValue({ success: true });
    const result = await useCase.execute({
      channel: NotificationChannel.SMS,
      recipient: '+254712345678',
      message: 'Hello',
    });
    expect(result).toBe(true);
    expect(mockSmsProvider.send).toHaveBeenCalledWith('+254712345678', 'Hello');
  });

  it('calls email provider for EMAIL channel', async () => {
    mockEmailProvider.send.mockResolvedValue({ success: true });
    const result = await useCase.execute({
      channel: NotificationChannel.EMAIL,
      recipient: 'alice@example.com',
      message: '<p>Hello</p>',
      subject: 'Test',
    });
    expect(result).toBe(true);
    expect(mockEmailProvider.send).toHaveBeenCalledWith('alice@example.com', 'Test', '<p>Hello</p>');
  });

  it('calls push provider for PUSH channel', async () => {
    mockPushProvider.sendToDevice.mockResolvedValue({ success: true });
    const result = await useCase.execute({
      channel: NotificationChannel.PUSH,
      recipient: 'fcm_token',
      message: 'You got paid!',
    });
    expect(result).toBe(true);
    expect(mockPushProvider.sendToDevice).toHaveBeenCalledWith('fcm_token', 'Notification', 'You got paid!');
  });

  it('throws BadRequestException for unsupported channel', async () => {
    await expect(
      useCase.execute({
        channel: 'FAX' as NotificationChannel,
        recipient: 'somewhere',
        message: 'Hello',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('error message names the unsupported channel', async () => {
    await expect(
      useCase.execute({
        channel: 'CARRIER_PIGEON' as NotificationChannel,
        recipient: 'somewhere',
        message: 'Hello',
      }),
    ).rejects.toThrow(/CARRIER_PIGEON/i);
  });

  it('returns false when provider reports failure', async () => {
    mockSmsProvider.send.mockResolvedValue({ success: false });
    const result = await useCase.execute({
      channel: NotificationChannel.SMS,
      recipient: '+254712345678',
      message: 'Hello',
    });
    expect(result).toBe(false);
  });
});
