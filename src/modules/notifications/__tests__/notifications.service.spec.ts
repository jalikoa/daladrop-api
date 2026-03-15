import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { NotificationsService } from '../notifications.service';
import { SendNotificationUseCase } from '../use-cases/send-notification.usecase';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NOTIFICATION_CONSTANTS } from '../constants/notification.constants';

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
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
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

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