// ─────────────────────────────────────────────────────────────────────────────
// NotificationsController
// ─────────────────────────────────────────────────────────────────────────────
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsController } from '../notifications/notifications.controller';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditController } from '../audit/audit.controller';
import { AuditService } from '../audit/audit.service';
import { HealthController } from '../health/health.controller';
import { HealthService } from '../health/health.service';
import { WebhooksController } from '../webhooks/webhooks.controller';
import { WebhooksService } from '../webhooks/webhooks.service';
import { PublicController } from '../../interfaces/public/public.controller';
import { DecodeTokenUseCase } from '../nfc/use-cases/decode-token.usecase';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { WebhookAuthGuard } from '../webhooks/guards/webhook-auth.guard';
import { WebhookSource, WebhookStatus } from '../webhooks/enums/webhook-source.enum';

const allowAll = { canActivate: () => true };

// ─── NotificationsController ──────────────────────────────────────────────────
describe('NotificationsController', () => {
  let controller: NotificationsController;
  const mockNotificationsService = {
    sendSms: jest.fn().mockResolvedValue(undefined),
    sendEmail: jest.fn().mockResolvedValue(undefined),
    sendPush: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: mockNotificationsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue(allowAll)
      .overrideGuard(RolesGuard).useValue(allowAll)
      .compile();
    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  describe('POST /notifications/sms', () => {
    it('enqueues SMS and returns void', async () => {
      await expect(controller.sendSms('+254712345678', 'Payment received')).resolves.toBeUndefined();
      expect(mockNotificationsService.sendSms).toHaveBeenCalledWith('+254712345678', 'Payment received');
    });
  });

  describe('POST /notifications/email', () => {
    it('enqueues email and returns void', async () => {
      await expect(
        controller.sendEmail('a@b.com', 'Receipt', '<p>Hello</p>'),
      ).resolves.toBeUndefined();
      expect(mockNotificationsService.sendEmail).toHaveBeenCalledWith('a@b.com', 'Receipt', '<p>Hello</p>');
    });
  });

  describe('POST /notifications/push', () => {
    it('enqueues push and returns void', async () => {
      await expect(
        controller.sendPush('fcm_token', 'Payment Done', 'KES 500 received'),
      ).resolves.toBeUndefined();
      expect(mockNotificationsService.sendPush).toHaveBeenCalledWith('fcm_token', 'Payment Done', 'KES 500 received');
    });
  });
});

// ─── AuditController ──────────────────────────────────────────────────────────
describe('AuditController', () => {
  let controller: AuditController;
  const mockAuditLog = {
    id: 1, user_id: 2, action: 'LOGIN', ip_address: '1.2.3.4',
    endpoint: '/auth/login', payload: {}, created_at: new Date(),
  };
  const mockAuditService = {
    getLogs: jest.fn().mockResolvedValue({ data: [mockAuditLog], total: 1 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: mockAuditService }],
    })
      .overrideGuard(JwtAuthGuard).useValue(allowAll)
      .overrideGuard(RolesGuard).useValue(allowAll)
      .compile();
    controller = module.get<AuditController>(AuditController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  describe('GET /audit/logs', () => {
    it('returns mapped log DTOs and total', async () => {
      const result = await controller.getLogs(1, 20);
      expect(result.total).toBe(1);
      expect(result.data[0].action).toBe('LOGIN');
    });

    it('maps only safe fields (no user_agent etc.)', async () => {
      const result = await controller.getLogs(1, 20);
      const log = result.data[0];
      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('action');
      expect(log).not.toHaveProperty('request_method');
    });

    it('passes user_id and action filters to service', async () => {
      await controller.getLogs(1, 20, 2, 'LOGIN');
      expect(mockAuditService.getLogs).toHaveBeenCalledWith(
        1, 20, { userId: 2, action: 'LOGIN' },
      );
    });
  });
});

// ─── HealthController ─────────────────────────────────────────────────────────
describe('HealthController', () => {
  let controller: HealthController;
  const mockHealthService = {
    checkAll: jest.fn(),
    checkReady: jest.fn(),
    getMetrics: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: mockHealthService }],
    })
      .overrideGuard(JwtAuthGuard).useValue(allowAll)
      .overrideGuard(RolesGuard).useValue(allowAll)
      .compile();
    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  describe('GET /health', () => {
    it('returns status ok when all checks pass', async () => {
      mockHealthService.checkAll.mockResolvedValue({
        database: { status: 'up' }, redis: { status: 'up' }, system: { status: 'up' },
      });
      const result = await controller.healthCheck();
      expect(result.status).toBe('ok');
      expect(result.info).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('returns status error and populates error field when any check fails', async () => {
      mockHealthService.checkAll.mockResolvedValue({
        database: { status: 'down' }, redis: { status: 'up' }, system: { status: 'up' },
      });
      const result = await controller.healthCheck();
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
      expect(result.info).toBeUndefined();
    });

    it('includes a timestamp', async () => {
      mockHealthService.checkAll.mockResolvedValue({ database: { status: 'up' } });
      const result = await controller.healthCheck();
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('GET /health/ready', () => {
    it('returns ready when service is ready', async () => {
      mockHealthService.checkReady.mockResolvedValue(true);
      const result = await controller.readinessCheck();
      expect(result.status).toBe('ready');
    });

    it('returns not_ready when service is not ready', async () => {
      mockHealthService.checkReady.mockResolvedValue(false);
      const result = await controller.readinessCheck();
      expect(result.status).toBe('not_ready');
    });
  });

  describe('GET /health/metrics', () => {
    it('returns metrics object', async () => {
      const metrics = { uptime: 100, memory_usage: { heapUsed: 50000 }, cpu_usage: 0, version: '1.0.0' };
      mockHealthService.getMetrics.mockReturnValue(metrics);
      const result = await controller.metrics();
      expect(result.uptime).toBe(100);
    });
  });

  describe('GET /health/version', () => {
    it('returns version and environment', async () => {
      const result = await controller.version();
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('environment');
    });
  });
});

// ─── WebhooksController ───────────────────────────────────────────────────────
describe('WebhooksController', () => {
  let controller: WebhooksController;
  const mockWebhooksService = {
    receiveWebhook: jest.fn(),
    getWebhookLog: jest.fn(),
    getWebhookLogs: jest.fn(),
  };

  const mockDarajaPayload = {
    Body: {
      stkCallback: {
        MerchantRequestID: '29115-34620561-1',
        CheckoutRequestID: 'ws_CO_1234',
        ResultCode: 0,
        ResultDesc: 'Success',
        CallbackMetadata: { Item: [{ Name: 'MpesaReceiptNumber', Value: 'NLJ7RT61SV' }] },
      },
    },
  };

  const mockWebhookLog = {
    id: 1, source: WebhookSource.DARAJA, event_type: 'stk.callback',
    status: WebhookStatus.COMPLETED, ip_address: '1.2.3.4',
    payload: {}, response_sent: null, error_message: null,
    received_at: new Date(), processed_at: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [{ provide: WebhooksService, useValue: mockWebhooksService }],
    })
      .overrideGuard(WebhookAuthGuard).useValue(allowAll)
      .compile();
    controller = module.get<WebhooksController>(WebhooksController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  describe('POST /webhooks/daraja/stk', () => {
    it('returns success response for valid Daraja callback', async () => {
      mockWebhooksService.receiveWebhook.mockResolvedValue({ success: true, webhookId: 1 });
      mockWebhooksService.getWebhookLog.mockResolvedValue(mockWebhookLog);
      const mockReq = {
        headers: {}, ip: '1.2.3.4',
        socket: { remoteAddress: '1.2.3.4' },
        get: () => 'Safaricom',
      } as any;

      const result = await controller.handleDarajaCallback(
        mockDarajaPayload as any, {}, mockReq,
      );
      expect(result.success).toBe(true);
      expect(result.meta.source).toBe(WebhookSource.DARAJA);
    });
  });

  describe('GET /webhooks/logs', () => {
    it('returns paginated webhook logs', async () => {
      mockWebhooksService.getWebhookLogs.mockResolvedValue({ data: [mockWebhookLog], total: 1 });
      const result = await controller.getWebhookLogs(1, 10);
      expect(result.total).toBe(1);
      expect(result.data[0].source).toBe(WebhookSource.DARAJA);
    });
  });

  describe('GET /webhooks/logs/:id', () => {
    it('returns a webhook log by ID', async () => {
      mockWebhooksService.getWebhookLog.mockResolvedValue(mockWebhookLog);
      const result = await controller.getWebhookLog(1);
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when log does not exist', async () => {
      mockWebhooksService.getWebhookLog.mockResolvedValue(null);
      await expect(controller.getWebhookLog(999)).rejects.toThrow(NotFoundException);
    });
  });
});

// ─── PublicController ─────────────────────────────────────────────────────────
describe('PublicController', () => {
  let controller: PublicController;
  const mockDecodeUseCase = { execute: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicController],
      providers: [{ provide: DecodeTokenUseCase, useValue: mockDecodeUseCase }],
    }).compile();
    controller = module.get<PublicController>(PublicController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  describe('GET /pay', () => {
    const makeMockResponse = () => {
      const res: any = {};
      res.json = jest.fn().mockReturnValue(res);
      res.status = jest.fn().mockReturnValue(res);
      return res;
    };

    it('responds with merchant data on valid token', async () => {
      const decodedData = {
        success: true,
        data: { merchant_id: 1, merchant_name: 'DemoShop', session_uuid: 'sess-123', expires_at: '' },
      };
      mockDecodeUseCase.execute.mockResolvedValue(decodedData);

      const mockReq = { ip: '1.2.3.4', get: () => 'Mozilla/5.0' } as any;
      const mockRes = makeMockResponse();

      await controller.handleNfcPaymentRequest('valid_token', mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: decodedData.data });
    });

    it('returns 400 JSON on decryption failure', async () => {
      mockDecodeUseCase.execute.mockRejectedValue(new Error('Invalid or corrupted payment token'));
      const mockReq = { ip: '1.2.3.4', get: () => '' } as any;
      const mockRes = makeMockResponse();

      await controller.handleNfcPaymentRequest('bad_token', mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.any(String) }),
      );
    });

    it('passes IP address and user-agent to use case', async () => {
      mockDecodeUseCase.execute.mockResolvedValue({ success: true, data: {} });
      const mockReq = { ip: '10.0.0.1', get: (h: string) => h === 'user-agent' ? 'curl/7.81' : '' } as any;
      const mockRes = makeMockResponse();

      await controller.handleNfcPaymentRequest('token', mockReq, mockRes);

      expect(mockDecodeUseCase.execute).toHaveBeenCalledWith({
        merchantId: 'token',
        ipAddress: '10.0.0.1',
        userAgent: 'curl/7.81',
      });
    });
  });
});