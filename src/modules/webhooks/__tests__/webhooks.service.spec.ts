import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WebhooksService } from '../webhooks.service';
import { WebhookSource, WebhookStatus } from '../enums/webhook-source.enum';
import { WebhookLog } from '../entities/webhook-log.entity';
import { DarajaWebhookHandler } from '../handlers/daraja-webhook.handler';
import { AfricaTalkingWebhookHandler } from '../handlers/africastalking-webhook.handler';

const mockWebhookLog = {
  id: 1,
  source: WebhookSource.DARAJA,
  event_type: 'stk.callback',
  status: WebhookStatus.RECEIVED,
  ip_address: '1.2.3.4',
  payload: {},
  response_sent: null,
  error_message: null,
  retry_count: 0,
  is_duplicate: false,
  idempotency_key: 'NLJ7RT61SV',
  received_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  processed_at: null,
  markProcessed: jest.fn(),
  markFailed: jest.fn(),
  markDuplicate: jest.fn(),
};

const mockDarajaPayload = {
  Body: {
    stkCallback: {
      MerchantRequestID: '29115-34620561-1',
      CheckoutRequestID: 'ws_CO_1234',
      ResultCode: 0,
      ResultDesc: 'The service request is processed successfully.',
      CallbackMetadata: {
        Item: [
          { Name: 'Amount', Value: 500 },
          { Name: 'MpesaReceiptNumber', Value: 'NLJ7RT61SV' },
          { Name: 'PhoneNumber', Value: 254712345678 },
        ],
      },
    },
  },
};

const mockWebhookRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockDarajaHandler = {
  validate: jest.fn().mockResolvedValue(true),
  getIdempotencyKey: jest.fn().mockReturnValue('NLJ7RT61SV'),
  getEventType: jest.fn().mockReturnValue('stk.callback'),
  process: jest.fn().mockResolvedValue({ success: true, eventsEmitted: ['payment.completed'] }),
};

const mockAfricaTalkingHandler = {
  validate: jest.fn().mockResolvedValue(true),
  getIdempotencyKey: jest.fn().mockReturnValue(null),
  getEventType: jest.fn().mockReturnValue('sms.delivered'),
  process: jest.fn().mockResolvedValue({ success: true, eventsEmitted: [] }),
};

const mockEventEmitter = { emit: jest.fn() };

describe('WebhooksService', () => {
  let service: WebhooksService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset mock log methods
    mockWebhookLog.markProcessed = jest.fn();
    mockWebhookLog.markFailed = jest.fn();

    mockWebhookRepo.create.mockReturnValue(mockWebhookLog);
    mockWebhookRepo.save.mockResolvedValue(mockWebhookLog);
    mockWebhookRepo.findOne.mockResolvedValue(null); // no duplicate by default

    const qb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockWebhookLog], 1]),
    };
    mockWebhookRepo.createQueryBuilder.mockReturnValue(qb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: 'WebhookLogRepository', useValue: mockWebhookRepo },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: DarajaWebhookHandler, useValue: mockDarajaHandler },
        { provide: AfricaTalkingWebhookHandler, useValue: mockAfricaTalkingHandler },
      ],
    })
      .overrideProvider(InjectRepository(WebhookLog))
      .useValue(mockWebhookRepo)
      .overrideProvider(EventEmitter2)
      .useValue(mockEventEmitter)
      .overrideProvider(DarajaWebhookHandler)
      .useValue(mockDarajaHandler)
      .overrideProvider(AfricaTalkingWebhookHandler)
      .useValue(mockAfricaTalkingHandler)
      .compile();
    service = module.get<WebhooksService>(WebhooksService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('receiveWebhook()', () => {
    it('processes a valid Daraja callback and returns success', async () => {
      const result = await service.receiveWebhook(
        WebhookSource.DARAJA, mockDarajaPayload, {}, '1.2.3.4',
      );
      expect(result.success).toBe(true);
      expect(result.webhookId).toBe(1);
    });

    it('throws BadRequestException for unsupported source', async () => {
      await expect(
        service.receiveWebhook('UNKNOWN' as WebhookSource, {}, {}, '1.2.3.4'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when handler validation fails', async () => {
      mockDarajaHandler.validate.mockResolvedValueOnce(false);
      await expect(
        service.receiveWebhook(WebhookSource.DARAJA, {}, {}, '1.2.3.4'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns existing webhook ID for duplicate idempotency key', async () => {
      const existingLog = { ...mockWebhookLog, id: 99 };
      mockWebhookRepo.findOne.mockResolvedValueOnce(existingLog);

      const result = await service.receiveWebhook(
        WebhookSource.DARAJA, mockDarajaPayload, {}, '1.2.3.4',
      );
      expect(result.webhookId).toBe(99);
      // handler.process should NOT be called for duplicates
      expect(mockDarajaHandler.process).not.toHaveBeenCalled();
    });

    it('emits RECEIVED and PROCESSED events', async () => {
      await service.receiveWebhook(WebhookSource.DARAJA, mockDarajaPayload, {}, '1.2.3.4');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        expect.stringContaining('received'), expect.any(Object),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        expect.stringContaining('processed'), expect.any(Object),
      );
    });
  });

  describe('getWebhookLogs()', () => {
    it('returns paginated webhook logs', async () => {
      const result = await service.getWebhookLogs(1, 10);
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe(1);
    });
  });

  describe('getWebhookLog()', () => {
    it('returns a single log by ID', async () => {
      mockWebhookRepo.findOne.mockResolvedValue(mockWebhookLog);
      const result = await service.getWebhookLog(1);
      expect(result?.id).toBe(1);
    });

    it('returns null when log does not exist', async () => {
      mockWebhookRepo.findOne.mockResolvedValue(null);
      const result = await service.getWebhookLog(999);
      expect(result).toBeNull();
    });
  });
});
