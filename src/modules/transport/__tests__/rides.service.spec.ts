import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentStatus, RideServiceType, RideStatus } from '@prisma/client';
import { kes } from '../../../shared/money';
import type { AuditLogService } from '../../operations/use-cases/audit-log.service';
import { RideQuoteService } from '../use-cases/ride-quote.service';
import { RidesService } from '../use-cases/rides.service';
import { MpesaPaymentStatusService } from '../use-cases/mpesa-payment-status.service';
import {
  RideEtaService,
  SurgePricingService,
} from '../../logistics/use-cases/surge-eta.service';

function buildRideRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-07-26T12:00:00.000Z');
  return {
    id: 'ride1',
    customerId: 'u1',
    riderId: null,
    serviceType: RideServiceType.PARCEL,
    status: RideStatus.PENDING_PAYMENT,
    vehicleType: 'BIKE',
    pickupAddress: null,
    pickupLatitude: -0.09,
    pickupLongitude: 34.76,
    dropoffAddress: null,
    dropoffLatitude: -0.1,
    dropoffLongitude: 34.75,
    fareAmount: 170n,
    currency: 'KES',
    distanceKm: 4.2,
    polyline: null,
    deliveryPricingRuleId: 'rule1',
    riderPayAmount: 140n,
    platformCommissionAmount: 30n,
    paymentStatus: PaymentStatus.PENDING,
    itemDescription: null,
    receiverPhone: null,
    weightCategory: null,
    courierPartnerId: null,
    interCountyRouteId: null,
    shareToken: null,
    cancelReason: null,
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildService(options: {
  readonly prisma: Record<string, unknown>;
  readonly payments?: Record<string, jest.Mock>;
  readonly ridersDiscovery?: Record<string, jest.Mock>;
  readonly deliveryQuote?: Record<string, jest.Mock>;
  readonly dispatch?: Record<string, jest.Mock>;
}) {
  const audit = { record: jest.fn() } as unknown as AuditLogService;
  const events = new EventEmitter2();
  const payments = {
    createAndInitiate: jest.fn(),
    retry: jest.fn(),
    ...options.payments,
  };
  const providerResolver = {
    resolveProviderCode: () => 'MPESA_DARAJA',
    requirePhone: (value?: string | null) => value ?? '254700000000',
    normalizePhone: (value?: string | null) => value ?? null,
  };
  const ridersDiscovery = {
    nearby: jest.fn().mockResolvedValue({ success: true, riders: [] }),
    ...options.ridersDiscovery,
  };
  const deliveryQuote = {
    quotePointToPoint: jest.fn().mockResolvedValue({
      customerCharge: kes(170),
      riderPay: kes(140),
      platformCommission: kes(30),
      ruleId: 'rule1',
      distanceKm: 4.2,
      logisticsServiceType: 'PARCEL',
      interCountyRouteId: null,
    }),
    ...options.deliveryQuote,
  };
  const quoteService = new RideQuoteService(
    deliveryQuote as never,
    new SurgePricingService(),
    new RideEtaService(),
    {
      quoteTransport: jest.fn(),
    } as never,
  );
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const dispatch = {
    autoAssignNearest: jest.fn().mockResolvedValue({ assigned: false }),
    ...options.dispatch,
  };

  const quoteEngine = {
    requireUsable: jest.fn().mockRejectedValue(new Error('unexpected quote')),
  };
  const service = new RidesService(
    options.prisma as never,
    audit,
    events,
    payments as never,
    quoteService,
    quoteEngine as never,
    providerResolver as never,
    ridersDiscovery as never,
    config as never,
    dispatch as never,
  );

  return { service, payments, ridersDiscovery, deliveryQuote, dispatch, quoteEngine };
}

describe('RidesService.createAndPay coordinate validation', () => {
  it('rejects 0,0 pickup coordinates before touching the database', async () => {
    const prisma = {
      ride: { create: jest.fn(), findFirst: jest.fn() },
    };
    const { service, payments } = buildService({ prisma });

    await expect(
      service.createAndPay('u1', {
        serviceType: RideServiceType.PARCEL,
        pickupLat: 0,
        pickupLng: 0,
        dropoffLat: -0.1,
        dropoffLng: 34.75,
        mpesaPhone: '254712345678',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.ride.create).not.toHaveBeenCalled();
    expect(payments.createAndInitiate).not.toHaveBeenCalled();
  });

  it('rejects non-finite coordinates', async () => {
    const prisma = { ride: { create: jest.fn(), findFirst: jest.fn() } };
    const { service } = buildService({ prisma });

    await expect(
      service.createAndPay('u1', {
        serviceType: RideServiceType.PARCEL,
        pickupLat: Number.NaN,
        pickupLng: 34.76,
        dropoffLat: -0.1,
        dropoffLng: 34.75,
        mpesaPhone: '254712345678',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('RidesService.createAndPay happy path', () => {
  it('creates a durable ride row before initiating STK and never succeeds without an initiated payment', async () => {
    const rideRow = buildRideRow();
    const prisma = {
      ride: {
        create: jest.fn().mockResolvedValue(rideRow),
        findFirst: jest.fn().mockResolvedValue(rideRow),
        update: jest.fn().mockResolvedValue(rideRow),
      },
      rideStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      courierPartner: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const { service, payments } = buildService({
      prisma,
      payments: {
        createAndInitiate: jest.fn().mockResolvedValue({
          id: 'pay1',
          checkoutRequestId: 'ws_CO_123',
          status: 'PROCESSING',
          failureMessage: null,
        }),
      },
    });

    const result = await service.createAndPay('u1', {
      serviceType: RideServiceType.PARCEL,
      pickupLat: -0.09,
      pickupLng: 34.76,
      dropoffLat: -0.1,
      dropoffLng: 34.75,
      mpesaPhone: '254712345678',
    });

    expect(prisma.ride.create).toHaveBeenCalledTimes(1);
    expect(payments.createAndInitiate).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'RIDE',
        rideId: 'ride1',
        amount: 170n,
        currency: 'KES',
      }),
    );
    expect(result.success).toBe(true);
    expect(result.rideId).toBe('ride1');
    expect(result.checkoutRequestId).toBe('ws_CO_123');
    expect(result.mpesa).toEqual({ initiated: true });
  });

  it('throws instead of returning success when the provider does not initiate STK', async () => {
    const rideRow = buildRideRow();
    const prisma = {
      ride: {
        create: jest.fn().mockResolvedValue(rideRow),
        findFirst: jest.fn().mockResolvedValue(rideRow),
        update: jest.fn().mockResolvedValue(rideRow),
      },
      rideStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      courierPartner: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const { service } = buildService({
      prisma,
      payments: {
        createAndInitiate: jest.fn().mockResolvedValue({
          id: 'pay1',
          checkoutRequestId: null,
          status: 'FAILED',
          failureMessage: 'Provider unreachable',
        }),
      },
    });

    await expect(
      service.createAndPay('u1', {
        serviceType: RideServiceType.PARCEL,
        pickupLat: -0.09,
        pickupLng: 34.76,
        dropoffLat: -0.1,
        dropoffLng: 34.75,
        mpesaPhone: '254712345678',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('RidesService.request boda no-riders path', () => {
  it('returns { success: false, noRiders: true } without creating a ride', async () => {
    const prisma = {
      ride: { create: jest.fn(), findFirst: jest.fn() },
    };
    const { service, ridersDiscovery } = buildService({
      prisma,
      ridersDiscovery: {
        nearby: jest.fn().mockResolvedValue({ success: true, riders: [] }),
      },
    });

    const result = await service.request('u1', {
      serviceType: RideServiceType.RIDE,
      pickupLat: -0.09,
      pickupLng: 34.76,
      dropoffLat: -0.1,
      dropoffLng: 34.75,
    });

    expect(result).toEqual({ success: false, noRiders: true });
    expect(prisma.ride.create).not.toHaveBeenCalled();
    expect(ridersDiscovery.nearby).toHaveBeenCalledWith(-0.09, 34.76, 5);
  });

  it('creates a SEARCHING ride when riders are nearby', async () => {
    const rideRow = buildRideRow({
      serviceType: RideServiceType.RIDE,
      status: RideStatus.SEARCHING,
    });
    const prisma = {
      ride: {
        create: jest.fn().mockResolvedValue(rideRow),
        findFirst: jest.fn().mockResolvedValue(rideRow),
      },
      rideStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      courierPartner: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const { service } = buildService({
      prisma,
      ridersDiscovery: {
        nearby: jest
          .fn()
          .mockResolvedValue({ success: true, riders: [{ id: 'r1' }] }),
      },
    });

    const result = await service.request('u1', {
      serviceType: RideServiceType.RIDE,
      pickupLat: -0.09,
      pickupLng: 34.76,
      dropoffLat: -0.1,
      dropoffLng: 34.75,
    });

    expect(result.success).toBe(true);
    expect((result as { rideId?: string }).rideId).toBe('ride1');
    expect(prisma.ride.create).toHaveBeenCalledTimes(1);
  });
});

describe('MpesaPaymentStatusService', () => {
  it('maps the latest RIDE payment to the tracking-poll shape', async () => {
    const createdAt = new Date('2026-07-26T12:00:00.000Z');
    const prisma = {
      ride: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'ride1', customerId: 'u1' }),
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pay1',
          status: 'SUCCESS',
          amount: 170n,
          createdAt,
          providerTransactions: [
            {
              providerReference: 'QGR12345',
              payerIdentifier: '254712345678',
              checkoutRequestId: 'ws_CO_123',
            },
          ],
        }),
      },
    };
    const service = new MpesaPaymentStatusService(prisma as never);

    const result = await service.getForRide('ride1', 'u1');

    expect(result).toEqual({
      success: true,
      payment: {
        id: 'pay1',
        status: 'SUCCESS',
        amount: 170,
        mpesaRef: 'QGR12345',
        phoneNumber: '254712345678',
        checkoutRequestId: 'ws_CO_123',
        createdAt: createdAt.toISOString(),
      },
    });
  });

  it('returns payment: null when the ride has no payment attempt yet', async () => {
    const prisma = {
      ride: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'ride1', customerId: 'u1' }),
      },
      payment: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new MpesaPaymentStatusService(prisma as never);

    await expect(service.getForRide('ride1', 'u1')).resolves.toEqual({
      success: true,
      payment: null,
    });
  });
});
