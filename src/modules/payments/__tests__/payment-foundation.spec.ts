import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Payment, PaymentTransitionError } from '../domain/payment';
import { ManualPaymentProvider } from '../adapters/manual-payment.provider';
import { PaymentProviderRegistry } from '../adapters/provider-registry';
import { PaymentsService } from '../use-cases/payments.service';
import { DarajaPaymentProvider } from '../adapters/daraja-payment.provider';
import { KopoKopoPaymentProvider } from '../adapters/kopokopo-payment.provider';

jest.mock('axios');

const paymentInput = {
  customerId: 'customer-1',
  amount: 2500n,
  currency: 'KES',
  purpose: 'ORDER',
  providerCode: 'MANUAL',
  idempotencyKey: 'idem-1',
};

describe('Payment state machine', () => {
  it('maps the rich completed lifecycle to public SUCCESS', () => {
    const payment = Payment.create(paymentInput);
    payment.transition('INITIATION_PENDING');
    payment.transition('AWAITING_CUSTOMER');
    payment.transition('CAPTURED');
    expect(payment.publicStatus).toBe('SUCCESS');
    expect(payment.pullEvents().map((event) => event.eventType)).toContain('PaymentCompleted');
  });

  it('rejects invalid transitions', () => {
    const payment = Payment.create(paymentInput);
    expect(() => payment.transition('REFUNDED')).toThrow(PaymentTransitionError);
  });
});

describe('PaymentProviderRegistry and ManualPaymentProvider', () => {
  it('resolves providers by code and rejects duplicates', () => {
    const manual = new ManualPaymentProvider();
    expect(new PaymentProviderRegistry([manual]).get('manual')).toBe(manual);
    expect(() => new PaymentProviderRegistry([manual, manual])).toThrow('Duplicate');
  });

  it('leaves manual initiation awaiting real administrator approval', async () => {
    const provider = new ManualPaymentProvider();
    await expect(
      provider.initiatePayment({
        paymentId: 'payment-1',
        amount: 2500n,
        currency: 'KES',
        idempotencyKey: 'idem',
        reference: 'DD-1',
      }),
    ).resolves.toMatchObject({ status: 'PENDING', raw: { approvalRequired: true } });
  });
});

describe('Webhook idempotency', () => {
  it('acknowledges an already processed provider event without applying it again', async () => {
    const provider = {
      code: 'TEST',
      handleWebhook: jest.fn().mockResolvedValue({
        eventId: 'event-1',
        status: 'COMPLETED',
        occurredAt: new Date(),
      }),
    };
    const repository = { hasProcessedCallback: jest.fn().mockResolvedValue(true) };
    const service = new PaymentsService(
      repository as never,
      { publish: jest.fn() },
      { get: () => provider } as never,
      { record: jest.fn() } as never,
      { refund: { findFirst: jest.fn(), create: jest.fn() } } as never,
    );
    await expect(
      service.handleWebhook('TEST', { headers: {}, body: {}, receivedAt: new Date() }),
    ).resolves.toEqual({ accepted: true, duplicate: true });
    expect(repository.hasProcessedCallback).toHaveBeenCalledWith('TEST', 'event-1');
  });
});

describe('HTTP provider request mapping', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const http = { get: jest.fn(), post: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(http as never);
  });

  it('maps Daraja STK push fields and whole-shilling amount', async () => {
    http.get.mockResolvedValueOnce({ data: { access_token: 'token', expires_in: '3600' } });
    http.post.mockResolvedValueOnce({
      data: {
        ResponseCode: '0',
        MerchantRequestID: 'merchant-1',
        CheckoutRequestID: 'checkout-1',
      },
    });
    const config = new ConfigService({
      DARAJA_ENABLED: 'true',
      DARAJA_CONSUMER_KEY: 'key',
      DARAJA_CONSUMER_SECRET: 'secret',
      DARAJA_SHORT_CODE: '174379',
      DARAJA_PASSKEY: 'passkey',
      DARAJA_CALLBACK_URL: 'https://example.test/daraja',
      DARAJA_CALLBACK_TOKEN: 'callback-token',
    });
    const provider = new DarajaPaymentProvider(config);
    await provider.initiatePayment({
      paymentId: 'payment-1',
      amount: 2500n,
      currency: 'KES',
      payerIdentifier: '254712345678',
      idempotencyKey: 'idem',
      reference: 'DD-1',
    });
    expect(http.post).toHaveBeenCalledWith(
      '/mpesa/stkpush/v1/processrequest',
      expect.objectContaining({ Amount: 2500, PhoneNumber: '254712345678' }),
      expect.any(Object),
    );
  });

  it('maps KopoKopo incoming payment amount as a KES string', async () => {
    http.post
      .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } })
      .mockResolvedValueOnce({ data: {}, headers: { location: '/api/v1/incoming_payments/kk-1' } });
    const config = new ConfigService({
      KOPOKOPO_ENABLED: 'true',
      KOPOKOPO_CLIENT_ID: 'client',
      KOPOKOPO_CLIENT_SECRET: 'secret',
      KOPOKOPO_TILL_NUMBER: 'K12345',
      KOPOKOPO_CALLBACK_URL: 'https://example.test/kopokopo',
      KOPOKOPO_WEBHOOK_SECRET: 'webhook',
    });
    const provider = new KopoKopoPaymentProvider(config);
    await provider.initiatePayment({
      paymentId: 'payment-1',
      amount: 2500n,
      currency: 'KES',
      payerIdentifier: '+254712345678',
      idempotencyKey: 'idem',
      reference: 'DD-1',
    });
    expect(http.post).toHaveBeenLastCalledWith(
      '/api/v1/incoming_payments',
      expect.objectContaining({ amount: { currency: 'KES', value: '2500' } }),
      expect.any(Object),
    );
  });
});
