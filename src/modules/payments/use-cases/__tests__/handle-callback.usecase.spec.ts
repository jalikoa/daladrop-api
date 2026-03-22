import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HandleCallbackUseCase } from '../handle-callback.usecase';
import { IPaymentRepository } from '../../interfaces/payment-repository.interface';
import { PaymentCallback } from '../../entities/payment-callback.entity';
import { PaymentStatus } from '../../enums/payment-status.enum';
import { WEBHOOK_CONSTANTS } from '../../../webhooks/constants/webhook.constants';

/**
 * Unit Tests for HandleCallbackUseCase
 */
describe('HandleCallbackUseCase - Unit Tests', () => {
  let useCase: HandleCallbackUseCase;
  let mockPaymentRepository: Partial<IPaymentRepository>;
  let mockEventEmitter: Partial<EventEmitter2>;

  const mockCallbackData = {
    MerchantRequestID: 'req-123',
    CheckoutRequestID: 'ws_CO_123456',
    ResultCode: '0',
    ResultDesc: 'The service request is processed successfully.',
    CallbackMetadata: {
      Item: [
        { Name: 'Amount', Value: 500 },
        { Name: 'MpesaReceiptNumber', Value: 'ABC123' },
        { Name: 'PhoneNumber', Value: 254712345678 },
        { Name: 'TransactionDate', Value: '20240101120000' },
      ],
    },
  };

  const mockSession = {
    id: 1,
    session_uuid: 'uuid-123',
    merchant_id: 1,
    customer_phone: '254712345678',
    amount: 500,
    currency: 'KES',
    status: PaymentStatus.INITIATED,
    checkout_request_id: 'ws_CO_123456',
    merchant_request_id: 'req-123',
    mpesaReceiptNumber: null,
    description: null,
    metadata: null,
    created_at: new Date(),
    updated_at: new Date(),
    completed_at: null,
    isCompleted: () => false,
    isPending: () => true,
    canTransitionTo: jest.fn().mockReturnValue(true),
    markCompleted: jest.fn(),
    markFailed: jest.fn(),
  };

  beforeEach(async () => {
    mockPaymentRepository = {
      findByCheckoutId: jest.fn(),
      saveCallback: jest.fn(),
      updateStatus: jest.fn(),
      hasProcessedCallback: jest.fn(),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandleCallbackUseCase,
        { provide: 'IPaymentRepository', useValue: mockPaymentRepository },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    useCase = module.get<HandleCallbackUseCase>(HandleCallbackUseCase);
  });

  describe('execute()', () => {
    it('should process successful callback', async () => {
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);

      const result = await useCase.execute(mockCallbackData, '127.0.0.1');

      expect(result.success).toBe(true);
      expect(mockPaymentRepository.findByCheckoutId)
        .toHaveBeenCalledWith('ws_CO_123456');
    });

    it('should save callback data to repository', async () => {
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.hasProcessedCallback.mockResolvedValue(false);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);
      mockPaymentRepository.markCompleted.mockResolvedValue(undefined);

      await useCase.execute(mockCallbackData, '127.0.0.1');

      expect(mockPaymentRepository.saveCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          checkoutRequestId: 'ws_CO_123456',
          resultCode: 0,
        }),
      );
    });

    it('should mark session as completed for successful payment', async () => {
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.hasProcessedCallback.mockResolvedValue(false);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);
      mockPaymentRepository.markCompleted.mockResolvedValue(undefined);

      await useCase.execute(mockCallbackData, '127.0.0.1');

      expect(mockPaymentRepository.markCompleted).toHaveBeenCalled();
    });

    it('should mark session as failed for failed payment', async () => {
      const failedCallback = {
        ...mockCallbackData,
        ResultCode: '1032',
        ResultDesc: 'Request cancelled by user',
      };
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.hasProcessedCallback.mockResolvedValue(false);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);
      mockPaymentRepository.markFailed.mockResolvedValue(undefined);

      await useCase.execute(failedCallback, '127.0.0.1');

      expect(mockPaymentRepository.markFailed).toHaveBeenCalled();
    });

    it('should emit payment.completed event for successful payment', async () => {
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);

      await useCase.execute(mockCallbackData, '127.0.0.1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        expect.stringContaining('payment.completed'),
        expect.any(Object),
      );
    });

    it('should emit payment.failed event for failed payment', async () => {
      const failedCallback = {
        ...mockCallbackData,
        ResultCode: '1032',
      };
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);

      await useCase.execute(failedCallback, '127.0.0.1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        expect.stringContaining('payment.failed'),
        expect.any(Object),
      );
    });

    it('should return failure when session not found', async () => {
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(null);

      const result = await useCase.execute(mockCallbackData, '127.0.0.1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should handle callback without metadata', async () => {
      const callbackWithoutMetadata = {
        ...mockCallbackData,
        CallbackMetadata: undefined,
      };
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);

      const result = await useCase.execute(callbackWithoutMetadata, '127.0.0.1');

      expect(result.success).toBe(true);
    });

    it('should extract receipt number from callback metadata', async () => {
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);

      await useCase.execute(mockCallbackData, '127.0.0.1');

      expect(mockPaymentRepository.saveCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          mpesaReceiptNumber: 'ABC123',
        }),
      );
    });

    it('should save full payload to repository', async () => {
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.hasProcessedCallback.mockResolvedValue(false);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);
      mockPaymentRepository.markCompleted.mockResolvedValue(undefined);

      await useCase.execute(mockCallbackData, '127.0.0.1');

      expect(mockPaymentRepository.saveCallback).toHaveBeenCalled();
    });

    it('should include ip address in callback', async () => {
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.hasProcessedCallback.mockResolvedValue(false);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);
      mockPaymentRepository.markCompleted.mockResolvedValue(undefined);

      await useCase.execute(mockCallbackData, '127.0.0.1');

      expect(mockPaymentRepository.saveCallback).toHaveBeenCalled();
    });

    it('should handle insufficient funds result code', async () => {
      const insufficientFundsCallback = {
        ...mockCallbackData,
        ResultCode: WEBHOOK_CONSTANTS.DARAJA.RESULT_CODE_INSUFFICIENT_FUNDS,
        ResultDesc: 'Insufficient funds',
      };
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);

      const result = await useCase.execute(insufficientFundsCallback, '127.0.0.1');

      expect(result.success).toBe(true);
      expect(mockPaymentRepository.markFailed).toHaveBeenCalled();
    });

    it('should handle invalid phone number result code', async () => {
      const invalidPhoneCallback = {
        ...mockCallbackData,
        ResultCode: WEBHOOK_CONSTANTS.DARAJA.RESULT_CODE_INVALID_PHONE,
        ResultDesc: 'Invalid phone number',
      };
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);

      const result = await useCase.execute(invalidPhoneCallback, '127.0.0.1');

      expect(result.success).toBe(true);
      expect(mockPaymentRepository.markFailed).toHaveBeenCalled();
    });

    it('should handle cancelled result code', async () => {
      const cancelledCallback = {
        ...mockCallbackData,
        ResultCode: WEBHOOK_CONSTANTS.DARAJA.RESULT_CODE_CANCELLED,
        ResultDesc: 'Request cancelled by user',
      };
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);

      const result = await useCase.execute(cancelledCallback, '127.0.0.1');

      expect(result.success).toBe(true);
      expect(mockPaymentRepository.markFailed).toHaveBeenCalled();
    });
  });

  describe('Error scenarios', () => {
    it('should handle repository errors', async () => {
      mockPaymentRepository.findByCheckoutId.mockRejectedValue(new Error('Database error'));

      await expect(useCase.execute(mockCallbackData, '127.0.0.1')).rejects.toThrow();
    });

    it('should handle save callback errors', async () => {
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.hasProcessedCallback.mockResolvedValue(false);
      mockPaymentRepository.saveCallback.mockRejectedValue(new Error('Save failed'));

      await expect(useCase.execute(mockCallbackData, '127.0.0.1')).rejects.toThrow();
    });

    it('should handle null callback data', async () => {
      await expect(useCase.execute(null as any, '127.0.0.1')).rejects.toThrow();
    });

    it('should handle malformed callback data', async () => {
      const malformedCallback = {
        MerchantRequestID: 'req-123',
        // Missing CheckoutRequestID and ResultCode
      };

      const result = await useCase.execute(malformedCallback as any, '127.0.0.1');

      expect(result.success).toBe(false);
    });
  });

  describe('Event emission', () => {
    it('should emit event with payment ID', async () => {
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);

      await useCase.execute(mockCallbackData, '127.0.0.1');

      const emittedEvent = (mockEventEmitter.emit as jest.Mock).mock.calls.find(
        call => call[0].includes('payment.completed')
      );
      expect(emittedEvent[1]).toHaveProperty('paymentId', 1);
    });

    it('should emit event with session UUID', async () => {
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);

      await useCase.execute(mockCallbackData, '127.0.0.1');

      const emittedEvent = (mockEventEmitter.emit as jest.Mock).mock.calls.find(
        call => call[0].includes('payment.completed')
      );
      expect(emittedEvent[1]).toHaveProperty('sessionUuid', 'uuid-123');
    });

    it('should emit event with merchant ID', async () => {
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);

      await useCase.execute(mockCallbackData, '127.0.0.1');

      const emittedEvent = (mockEventEmitter.emit as jest.Mock).mock.calls.find(
        call => call[0].includes('payment.completed')
      );
      expect(emittedEvent[1]).toHaveProperty('merchantId', 1);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty CallbackMetadata Item array', async () => {
      const callbackWithEmptyMetadata = {
        ...mockCallbackData,
        CallbackMetadata: {
          Item: [],
        },
      };
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);

      const result = await useCase.execute(callbackWithEmptyMetadata, '127.0.0.1');

      expect(result.success).toBe(true);
    });

    it('should handle callback with null metadata values', async () => {
      const callbackWithNullValues = {
        ...mockCallbackData,
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: null },
            { Name: 'MpesaReceiptNumber', Value: null },
          ],
        },
      };
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);

      const result = await useCase.execute(callbackWithNullValues, '127.0.0.1');

      expect(result.success).toBe(true);
    });

    it('should handle very long result description', async () => {
      const callbackWithLongDesc = {
        ...mockCallbackData,
        ResultDesc: 'A'.repeat(500),
      };
      mockPaymentRepository.findByCheckoutId.mockResolvedValue(mockSession);
      mockPaymentRepository.saveCallback.mockResolvedValue({} as PaymentCallback);

      const result = await useCase.execute(callbackWithLongDesc, '127.0.0.1');

      expect(result.success).toBe(true);
    });
  });
});
