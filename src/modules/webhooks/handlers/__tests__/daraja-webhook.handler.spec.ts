import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DarajaWebhookHandler } from '../daraja-webhook.handler';
import { DarajaSignatureValidator } from '../../validators/daraja-signature.validator';
import { HandleCallbackUseCase } from '../../../payments/use-cases/handle-callback.usecase';
import { WebhookLog } from '../../entities/webhook-log.entity';
import { WEBHOOK_CONSTANTS } from '../../constants/webhook.constants';

/**
 * Unit Tests for DarajaWebhookHandler
 */
describe('DarajaWebhookHandler - Unit Tests', () => {
  let handler: DarajaWebhookHandler;
  let mockSignatureValidator: Partial<DarajaSignatureValidator>;
  let mockEventEmitter: Partial<EventEmitter2>;
  let mockHandleCallbackUseCase: Partial<HandleCallbackUseCase>;

  const mockWebhookLog: Partial<WebhookLog> = {
    id: 1,
    ip_address: '127.0.0.1',
    markCompleted: jest.fn(),
    markFailed: jest.fn(),
  };

  const validCallbackPayload = {
    Body: {
      stkCallback: {
        MerchantRequestID: 'req-123',
        CheckoutRequestID: 'ws_CO_123456',
        ResultCode: '0', // String as per Daraja API
        ResultDesc: 'The service request is processed successfully.',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: 500 },
            { Name: 'MpesaReceiptNumber', Value: 'ABC123' },
            { Name: 'PhoneNumber', Value: 254712345678 },
          ],
        },
      },
    },
  };

  const failedCallbackPayload = {
    Body: {
      stkCallback: {
        MerchantRequestID: 'req-123',
        CheckoutRequestID: 'ws_CO_123456',
        ResultCode: '1032', // String as per Daraja API
        ResultDesc: 'Request cancelled by user',
      },
    },
  };

  beforeEach(async () => {
    mockSignatureValidator = {
      verify: jest.fn(),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    mockHandleCallbackUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DarajaWebhookHandler,
        { provide: DarajaSignatureValidator, useValue: mockSignatureValidator },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: HandleCallbackUseCase, useValue: mockHandleCallbackUseCase },
      ],
    }).compile();

    handler = module.get<DarajaWebhookHandler>(DarajaWebhookHandler);
  });

  describe('Construction', () => {
    it('should create handler instance', () => {
      expect(handler).toBeDefined();
    });
  });

  describe('validate()', () => {
    it('should return true for valid payload without signature', async () => {
      const result = await handler.validate(validCallbackPayload, {});

      expect(result).toBe(true);
    });

    it('should return true when signature validation passes', async () => {
      (mockSignatureValidator.verify as jest.Mock).mockResolvedValue(true);

      const result = await handler.validate(validCallbackPayload, {
        'x-signature': 'valid-signature',
      });

      expect(result).toBe(true);
      expect(mockSignatureValidator.verify).toHaveBeenCalled();
    });

    it('should return false when signature validation fails', async () => {
      (mockSignatureValidator.verify as jest.Mock).mockResolvedValue(false);

      const result = await handler.validate(validCallbackPayload, {
        'x-signature': 'invalid-signature',
      });

      expect(result).toBe(false);
    });

    it('should return false for null payload', async () => {
      const result = await handler.validate(null, {});

      expect(result).toBe(false);
    });

    it('should return false for non-object payload', async () => {
      const result = await handler.validate('string-payload', {});

      expect(result).toBe(false);
    });

    it('should return false when CheckoutRequestID is missing', async () => {
      const payload = {
        Body: {
          stkCallback: {
            ResultCode: 0,
          },
        },
      };

      const result = await handler.validate(payload, {});

      expect(result).toBe(false);
    });

    it('should return false when ResultCode is missing', async () => {
      const payload = {
        Body: {
          stkCallback: {
            CheckoutRequestID: 'ws_CO_123',
          },
        },
      };

      const result = await handler.validate(payload, {});

      expect(result).toBe(false);
    });

    it('should return false when Body is missing', async () => {
      const payload = {
        stkCallback: {
          CheckoutRequestID: 'ws_CO_123',
          ResultCode: 0,
        },
      };

      const result = await handler.validate(payload, {});

      expect(result).toBe(false);
    });

    it('should return false when stkCallback is missing', async () => {
      const payload = {
        Body: {},
      };

      const result = await handler.validate(payload, {});

      expect(result).toBe(false);
    });

    it('should accept X-Signature header (uppercase)', async () => {
      (mockSignatureValidator.verify as jest.Mock).mockResolvedValue(true);

      const result = await handler.validate(validCallbackPayload, {
        'X-Signature': 'valid-signature',
      });

      expect(result).toBe(true);
    });

    it('should accept valid payload with ResultCode 1032 (failed)', async () => {
      const result = await handler.validate(failedCallbackPayload, {});

      expect(result).toBe(true);
    });
  });

  describe('process()', () => {
    it('should process successful callback', async () => {
      (mockHandleCallbackUseCase.execute as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Payment processed successfully',
      });

      const result = await handler.process(validCallbackPayload, mockWebhookLog as WebhookLog);

      expect(result.success).toBe(true);
      expect(result.eventsEmitted).toContain('payment.completed');
      expect(mockHandleCallbackUseCase.execute).toHaveBeenCalledWith(
        validCallbackPayload.Body.stkCallback,
        '127.0.0.1',
      );
    });

    it('should process failed callback', async () => {
      (mockHandleCallbackUseCase.execute as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Payment failed',
      });

      const result = await handler.process(failedCallbackPayload, mockWebhookLog as WebhookLog);

      expect(result.success).toBe(true);
      expect(result.eventsEmitted).toContain('payment.failed');
    });

    it('should handle processing error', async () => {
      (mockHandleCallbackUseCase.execute as jest.Mock).mockRejectedValue(new Error('Processing failed'));

      const result = await handler.process(validCallbackPayload, mockWebhookLog as WebhookLog);

      expect(result.success).toBe(false);
      expect(result.eventsEmitted).toHaveLength(0);
      expect(result.error).toContain('Processing failed');
    });

    it('should handle non-Error exceptions', async () => {
      (mockHandleCallbackUseCase.execute as jest.Mock).mockRejectedValue('String error');

      const result = await handler.process(validCallbackPayload, mockWebhookLog as WebhookLog);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should log processing start', async () => {
      (mockHandleCallbackUseCase.execute as jest.Mock).mockResolvedValue({ success: true });

      await handler.process(validCallbackPayload, mockWebhookLog as WebhookLog);

      expect(mockHandleCallbackUseCase.execute).toHaveBeenCalled();
    });

    it('should return checkout request ID in result data', async () => {
      (mockHandleCallbackUseCase.execute as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Success',
      });

      const result = await handler.process(validCallbackPayload, mockWebhookLog as WebhookLog);

      expect(result.data).toHaveProperty('checkoutRequestId', 'ws_CO_123456');
    });
  });

  describe('getEventType()', () => {
    it('should return payment.completed for successful ResultCode', () => {
      const result = handler.getEventType(validCallbackPayload);

      expect(result).toBe('payment.completed');
    });

    it('should return payment.failed for failed ResultCode', () => {
      const result = handler.getEventType(failedCallbackPayload);

      expect(result).toBe('payment.failed');
    });

    it('should return payment.failed for missing ResultCode', () => {
      const result = handler.getEventType({ Body: {} });

      expect(result).toBe('payment.failed');
    });

    it('should return payment.failed for null payload', () => {
      const result = handler.getEventType(null);

      expect(result).toBe('payment.failed');
    });
  });

  describe('getIdempotencyKey()', () => {
    it('should return MpesaReceiptNumber as idempotency key', () => {
      const result = handler.getIdempotencyKey(validCallbackPayload);

      expect(result).toBe('ABC123');
    });

    it('should return CheckoutRequestID when receipt number is missing', () => {
      const payload = {
        Body: {
          stkCallback: {
            CheckoutRequestID: 'ws_CO_123',
            ResultCode: 0,
          },
        },
      };

      const result = handler.getIdempotencyKey(payload);

      expect(result).toBe('ws_CO_123');
    });

    it('should return null when both receipt and checkout ID are missing', () => {
      const payload = {
        Body: {
          stkCallback: {
            ResultCode: 0,
          },
        },
      };

      const result = handler.getIdempotencyKey(payload);

      expect(result).toBeNull();
    });

    it('should return null for null payload', () => {
      const result = handler.getIdempotencyKey(null);

      expect(result).toBeNull();
    });

    it('should return null for malformed payload', () => {
      const result = handler.getIdempotencyKey({ invalid: 'payload' });

      expect(result).toBeNull();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete successful payment flow', async () => {
      (mockSignatureValidator.verify as jest.Mock).mockResolvedValue(true);
      (mockHandleCallbackUseCase.execute as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Payment completed',
      });

      // Validate
      const isValid = await handler.validate(validCallbackPayload, {
        'x-signature': 'valid',
      });
      expect(isValid).toBe(true);

      // Process
      const result = await handler.process(validCallbackPayload, mockWebhookLog as WebhookLog);
      expect(result.success).toBe(true);
      expect(result.eventsEmitted).toContain('payment.completed');
    });

    it('should handle complete failed payment flow', async () => {
      (mockHandleCallbackUseCase.execute as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Payment cancelled',
      });

      const result = await handler.process(failedCallbackPayload, mockWebhookLog as WebhookLog);

      expect(result.success).toBe(true);
      expect(result.eventsEmitted).toContain('payment.failed');
    });

    it('should handle callback with metadata missing', async () => {
      const payload = {
        Body: {
          stkCallback: {
            CheckoutRequestID: 'ws_CO_123',
            ResultCode: 0,
            ResultDesc: 'Success',
          },
        },
      };

      (mockHandleCallbackUseCase.execute as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Success',
      });

      const result = await handler.process(payload, mockWebhookLog as WebhookLog);

      expect(result.success).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty CallbackMetadata', async () => {
      const payload = {
        Body: {
          stkCallback: {
            CheckoutRequestID: 'ws_CO_123',
            ResultCode: 0,
            CallbackMetadata: {},
          },
        },
      };

      const result = handler.getIdempotencyKey(payload);

      expect(result).toBe('ws_CO_123');
    });

    it('should handle null CallbackMetadata Item', async () => {
      const payload = {
        Body: {
          stkCallback: {
            CheckoutRequestID: 'ws_CO_123',
            ResultCode: 0,
            CallbackMetadata: {
              Item: null,
            },
          },
        },
      };

      const result = handler.getIdempotencyKey(payload);

      expect(result).toBe('ws_CO_123');
    });

    it('should handle different receipt number formats', async () => {
      const payload = {
        Body: {
          stkCallback: {
            CheckoutRequestID: 'ws_CO_123',
            ResultCode: 0,
            CallbackMetadata: {
              Item: [
                { Name: 'MpesaReceiptNumber', Value: 'QEH1234567890' },
              ],
            },
          },
        },
      };

      const result = handler.getIdempotencyKey(payload);

      expect(result).toBe('QEH1234567890');
    });
  });
});
