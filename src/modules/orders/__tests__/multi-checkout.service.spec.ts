import { BadRequestException, HttpException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ModuleType } from '@prisma/client';
import { MultiCheckoutService } from '../use-cases/multi-checkout.service';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import type { DeliveryQuoteService } from '../../logistics/use-cases/delivery-quote.service';
import type { AgeVerificationService } from '../../compliance/use-cases/age-verification.service';
import type { PaymentsService } from '../../payments/use-cases/payments.service';
import type { OrdersPaymentHelper } from '../helpers/orders-payment.helper';
import { kes } from '../../../shared/money';

describe('MultiCheckoutService', () => {
  const actor = {
    id: 'cust-1',
    roles: ['CUSTOMER'],
    permissions: [],
    sessionId: 's1',
  };

  const quote = {
    customerCharge: kes(120),
    riderPay: kes(100),
    platformCommission: kes(20),
    ruleId: 'rule-1',
    constraintId: 'constraint-1',
    distanceKm: 2.1,
    serviceType: 'NORMAL_DELIVERY',
    maxDistanceKm: 9,
    suggestParcel: false,
  };

  function buildService(overrides: {
    ageStatus?: 'verified' | 'unverified' | 'pending';
    payments?: { createAndInitiate: jest.Mock };
  }) {
    const orderCreate = jest.fn().mockResolvedValue({ id: 'order-1' });
    const prisma = {
      store: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'store-1',
          storeType: 'LIQUOR',
          isActive: true,
          deletedAt: null,
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'store-1',
            storeType: 'LIQUOR',
            isActive: true,
            deletedAt: null,
          },
        ]),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'prod-1',
          name: 'Whiskey',
          priceAmount: 1500n,
          imageUrl: null,
          isAvailable: true,
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'prod-1',
            name: 'Whiskey',
            priceAmount: 1500n,
            imageUrl: null,
            isActive: true,
            inStock: true,
          },
        ]),
      },
      menuItem: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) =>
        cb({
          order: { create: orderCreate },
          pricingQuote: { update: jest.fn().mockResolvedValue({}) },
        }),
      ),
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'order-1',
          customerId: 'cust-1',
          status: 'PENDING_PAYMENT',
          paymentStatus: 'PENDING',
          totalAmount: 1634n,
          currency: 'KES',
          deletedAt: null,
        }),
        update: jest.fn(),
      },
    } as unknown as PrismaService;

    const quotes = {
      resolveServiceFee: jest.fn().mockResolvedValue(kes(14)),
      quoteNormalDelivery: jest.fn().mockResolvedValue(quote),
      quoteGasDelivery: jest.fn(),
      feesToBigInt: jest.fn().mockReturnValue({
        deliveryFeeAmount: 120n,
        riderPayAmount: 100n,
        platformCommissionAmount: 20n,
      }),
    } as unknown as DeliveryQuoteService;

    const quoteEngine = {
      requireUsable: jest.fn(),
      markConsumed: jest.fn().mockResolvedValue({}),
      quoteCheckout: jest.fn().mockResolvedValue({
        quoteId: 'pq-1',
        amounts: {
          deliveryFee: 120,
          serviceFee: 14,
          total: 1634,
          platformFee: 20,
        },
        earnings: { rider: 100, merchant: 1480, platform: 34 },
        distanceKm: 2.1,
        ruleId: 'rule-1',
        breakdown: { constraintId: 'constraint-1' },
      }),
    } as unknown as import('../../logistics/use-cases/quote-engine.service').QuoteEngineService;

    const ageVerification = {
      getStatus: jest
        .fn()
        .mockResolvedValue({ status: overrides.ageStatus ?? 'verified' }),
    } as unknown as AgeVerificationService;

    const payments = (overrides.payments ?? {
      createAndInitiate: jest.fn().mockResolvedValue({
        id: 'pay-1',
        checkoutRequestId: 'ws_123',
        status: 'PROCESSING',
      }),
    }) as unknown as PaymentsService;

    const paymentHelper = {
      stkOnPlaceEnabled: () => false,
      resolveProviderCode: () => 'MPESA_DARAJA',
      requirePhone: (v: string) => v,
      normalizePhone: (v: string) => v,
    } as unknown as OrdersPaymentHelper;

    const service = new MultiCheckoutService(
      prisma,
      quotes,
      quoteEngine,
      ageVerification,
      payments,
      paymentHelper,
      new EventEmitter2(),
    );

    return { service, prisma, ageVerification, payments, orderCreate, quoteEngine };
  }

  it('rejects liquor checkout when age is not verified (423)', async () => {
    const { service, ageVerification } = buildService({
      ageStatus: 'unverified',
    });

    await expect(
      service.place(ModuleType.LIQUOR, actor, {
        customerId: 'cust-1',
        lat: -1.29,
        lng: 36.82,
        orders: [
          {
            storeId: 'store-1',
            items: [{ productId: 'prod-1', quantity: 1 }],
          },
        ],
      }),
    ).rejects.toMatchObject({
      status: 423,
      response: expect.objectContaining({
        code: 'AGE_VERIFICATION_REQUIRED',
        success: false,
      }),
    });
    expect(ageVerification.getStatus).toHaveBeenCalledWith('cust-1');
  });

  it('rejects when actor customerId mismatches', async () => {
    const { service } = buildService({ ageStatus: 'verified' });
    await expect(
      service.place(ModuleType.MARKET, actor, {
        customerId: 'other-user',
        lat: -1.29,
        lng: 36.82,
        orders: [
          {
            storeId: 'store-1',
            items: [{ productId: 'prod-1', quantity: 1 }],
          },
        ],
      }),
    ).rejects.toThrow(/customerId must match/);
  });

  it('creates PENDING_PAYMENT order when liquor age is verified', async () => {
    const { service, orderCreate } = buildService({ ageStatus: 'verified' });
    const result = await service.place(ModuleType.LIQUOR, actor, {
      customerId: 'cust-1',
      lat: -1.29,
      lng: 36.82,
      orders: [
        {
          storeId: 'store-1',
          items: [{ productId: 'prod-1', quantity: 1 }],
        },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.orderIds).toEqual(['order-1']);
    expect(result.checkoutRequestId).toBeNull();
    expect(orderCreate).toHaveBeenCalled();
  });

  it('rejects when neither lat/lng nor deliveryLat/deliveryLng is provided', async () => {
    const { service } = buildService({ ageStatus: 'verified' });
    await expect(
      service.place(ModuleType.MARKET, actor, {
        customerId: 'cust-1',
        orders: [
          {
            storeId: 'store-1',
            items: [{ productId: 'prod-1', quantity: 1 }],
          },
        ],
      } as never),
    ).rejects.toBeInstanceOf(Error);
  });

  it('uses deliveryLat/deliveryLng for the created order when both aliases are present', async () => {
    const { service, orderCreate } = buildService({ ageStatus: 'verified' });
    await service.place(ModuleType.MARKET, actor, {
      customerId: 'cust-1',
      lat: 1,
      lng: 2,
      deliveryLat: -1.29,
      deliveryLng: 36.82,
      orders: [
        {
          storeId: 'store-1',
          items: [{ productId: 'prod-1', quantity: 1 }],
        },
      ],
    } as never);

    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryLatitude: -1.29,
          deliveryLongitude: 36.82,
        }),
      }),
    );
  });

  it('allows payment when order status is ACCEPTED and unpaid (restaurant accepted before customer paid)', async () => {
    const createAndInitiate = jest.fn().mockResolvedValue({
      id: 'pay-1',
      checkoutRequestId: 'ws_accept',
      status: 'PROCESSING',
    });
    const { service, prisma } = buildService({
      ageStatus: 'verified',
      payments: { createAndInitiate },
    });
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1',
      customerId: 'cust-1',
      status: 'ACCEPTED',
      paymentStatus: 'PENDING',
      totalAmount: 1634n,
      currency: 'KES',
      deletedAt: null,
    });

    const result = await service.initiateOrderPayment(
      'order-1',
      'cust-1',
      '254712345678',
    );

    expect(result.initiated).toBe(true);
    expect(createAndInitiate).toHaveBeenCalled();
  });

  it('rejects payment when order status is ACCEPTED but paymentStatus is already SUCCESS', async () => {
    const { service, prisma } = buildService({ ageStatus: 'verified' });
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1',
      customerId: 'cust-1',
      status: 'ACCEPTED',
      paymentStatus: 'SUCCESS',
      totalAmount: 1634n,
      currency: 'KES',
      deletedAt: null,
    });

    const result = await service.initiateOrderPayment(
      'order-1',
      'cust-1',
      '254712345678',
    );

    expect(result.initiated).toBe(false);
  });

  it('rejects payment for statuses beyond ACCEPTED (e.g. PREPARING)', async () => {
    const { service, prisma } = buildService({ ageStatus: 'verified' });
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-1',
      customerId: 'cust-1',
      status: 'PREPARING',
      paymentStatus: 'PENDING',
      totalAmount: 1634n,
      currency: 'KES',
      deletedAt: null,
    });

    await expect(
      service.initiateOrderPayment('order-1', 'cust-1', '254712345678'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('initiateOrderPayment calls PaymentsService with purpose ORDER', async () => {
    const createAndInitiate = jest.fn().mockResolvedValue({
      id: 'pay-1',
      checkoutRequestId: 'ws_abc',
      status: 'PROCESSING',
    });
    const { service, payments } = buildService({
      ageStatus: 'verified',
      payments: { createAndInitiate },
    });

    const result = await service.initiateOrderPayment(
      'order-1',
      'cust-1',
      '254712345678',
    );

    expect(createAndInitiate).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'ORDER',
        orderId: 'order-1',
        providerCode: 'MPESA_DARAJA',
        amount: 1634n,
      }),
    );
    expect(result.initiated).toBe(true);
    expect(result.checkoutRequestId).toBe('ws_abc');
    expect(payments.createAndInitiate).toHaveBeenCalled();
  });
});

describe('HttpException shape for age gate', () => {
  it('uses 423 Locked semantics', () => {
    const err = new HttpException(
      {
        success: false,
        error: 'AGE_VERIFICATION_REQUIRED',
        code: 'AGE_VERIFICATION_REQUIRED',
        status: 'unverified',
      },
      423,
    );
    expect(err.getStatus()).toBe(423);
  });
});
