import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  InboundWebhookStatus,
  PaymentMethod,
  PaymentProvider as PrismaPaymentProvider,
  PaymentPurpose,
  PaymentReferenceType,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { Payment } from '../../domain/payment';
import type {
  PaymentListQuery,
  PaymentRepository,
  ProviderTransactionRecord,
} from '../payment.repository';
import { deriveLifecycle } from '../payment.repository';
import {
  fromPersistedLifecycle,
  toPersistedLifecycle,
} from '../../mappers/lifecycle.mapper';

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async save(payment: Payment): Promise<void> {
    const value = payment.snapshot();
    const metadata = this.linkedIds(value);
    await this.prisma.payment.upsert({
      where: { id: value.id },
      create: {
        id: value.id,
        customerId: value.customerId,
        amount: value.amount,
        currency: value.currency,
        purpose: value.purpose as PaymentPurpose,
        provider: this.provider(value.providerCode),
        method: PaymentMethod.MOBILE_MONEY,
        status: payment.publicStatus as PaymentStatus,
        lifecycleStatus: toPersistedLifecycle(value.lifecycle),
        idempotencyKey: value.idempotencyKey,
        reference: value.reference,
        internalRef: value.reference,
        failureCode: value.failureCode,
        failureMessage: value.failureMessage,
        expiresAt: value.expiresAt,
        initiatedAt: value.createdAt,
        orderId: metadata.orderId,
        rideId: metadata.rideId,
        eventBookingId: metadata.eventBookingId,
        metadata: this.json(metadata.extra),
      },
      update: {
        status: payment.publicStatus as PaymentStatus,
        lifecycleStatus: toPersistedLifecycle(value.lifecycle),
        reference: value.reference,
        internalRef: value.reference,
        failureCode: value.failureCode,
        failureMessage: value.failureMessage,
        expiresAt: value.expiresAt,
        completedAt:
          payment.publicStatus === 'SUCCESS' ? value.updatedAt : undefined,
        orderId: metadata.orderId,
        rideId: metadata.rideId,
        eventBookingId: metadata.eventBookingId,
        metadata: this.json(metadata.extra),
      },
    });

    if (value.reference) {
      await this.prisma.paymentReference.upsert({
        where: {
          type_provider_value: {
            type: PaymentReferenceType.INTERNAL,
            provider: '',
            value: value.reference,
          },
        },
        create: {
          id: randomUUID(),
          paymentId: value.id,
          type: PaymentReferenceType.INTERNAL,
          provider: '',
          value: value.reference,
        },
        update: {},
      });
    }
  }

  public async findById(id: string): Promise<Payment | null> {
    return this.restore(
      await this.prisma.payment.findUnique({ where: { id } }),
    );
  }

  public async findByIdempotencyKey(key: string): Promise<Payment | null> {
    return this.restore(
      await this.prisma.payment.findFirst({ where: { idempotencyKey: key } }),
    );
  }

  public async findByReference(reference: string): Promise<Payment | null> {
    return this.restore(
      await this.prisma.payment.findFirst({
        where: { OR: [{ reference }, { internalRef: reference }] },
      }),
    );
  }

  public async findByProviderReference(
    reference: string,
  ): Promise<Payment | null> {
    const transaction = await this.prisma.paymentProviderTransaction.findFirst({
      where: {
        OR: [
          { providerReference: reference },
          { checkoutRequestId: reference },
          { merchantRequestId: reference },
        ],
      },
      select: { payment: true },
      orderBy: { createdAt: 'desc' },
    });
    return this.restore(transaction?.payment ?? null);
  }

  public async list(query: PaymentListQuery): Promise<readonly Payment[]> {
    const rows = await this.prisma.payment.findMany({
      where: {
        status: query.status as PaymentStatus | undefined,
        provider: query.providerCode
          ? this.provider(query.providerCode)
          : undefined,
        customerId: query.customerId,
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset,
    });
    return rows.map((row) => this.restore(row)!);
  }

  public async saveProviderTransaction(
    record: ProviderTransactionRecord,
  ): Promise<void> {
    await this.prisma.paymentProviderTransaction.create({
      data: {
        id: record.id,
        paymentId: record.paymentId,
        provider: this.provider(record.providerCode),
        providerReference: record.providerReference,
        checkoutRequestId: record.checkoutReference,
        payerIdentifier: record.payerIdentifier,
        status: this.resultStatus(record.result.status),
        requestPayload: this.json(record.request),
        responsePayload: this.json(record.result.raw),
        metadata: this.json({
          message: record.result.message,
          failureCode: record.result.failureCode,
        }),
      },
    });

    if (record.providerReference) {
      await this.prisma.paymentReference.upsert({
        where: {
          type_provider_value: {
            type: PaymentReferenceType.PROVIDER,
            provider: record.providerCode,
            value: record.providerReference,
          },
        },
        create: {
          id: randomUUID(),
          paymentId: record.paymentId,
          type: PaymentReferenceType.PROVIDER,
          provider: record.providerCode,
          value: record.providerReference,
        },
        update: {},
      });
    }
    if (record.checkoutReference) {
      await this.prisma.paymentReference.upsert({
        where: {
          type_provider_value: {
            type: PaymentReferenceType.GATEWAY,
            provider: record.providerCode,
            value: record.checkoutReference,
          },
        },
        create: {
          id: randomUUID(),
          paymentId: record.paymentId,
          type: PaymentReferenceType.GATEWAY,
          provider: record.providerCode,
          value: record.checkoutReference,
        },
        update: {},
      });
    }
  }

  public async latestProviderReference(
    paymentId: string,
  ): Promise<string | null> {
    const row = await this.prisma.paymentProviderTransaction.findFirst({
      where: { paymentId },
      orderBy: { createdAt: 'desc' },
      select: { providerReference: true, checkoutRequestId: true },
    });
    return row?.checkoutRequestId ?? row?.providerReference ?? null;
  }

  public async latestPayerIdentifier(
    paymentId: string,
  ): Promise<string | null> {
    const row = await this.prisma.paymentProviderTransaction.findFirst({
      where: { paymentId, payerIdentifier: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { payerIdentifier: true },
    });
    return row?.payerIdentifier ?? null;
  }

  public async hasProcessedCallback(
    providerCode: string,
    eventId: string,
  ): Promise<boolean> {
    const row = await this.prisma.inboundWebhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider: this.provider(providerCode),
          eventId,
        },
      },
      select: { status: true },
    });
    return row?.status === InboundWebhookStatus.PROCESSED;
  }

  public async claimCallback(
    providerCode: string,
    eventId: string,
    paymentId: string,
    payload: unknown,
  ): Promise<boolean> {
    const provider = this.provider(providerCode);
    try {
      await this.prisma.inboundWebhookEvent.create({
        data: {
          id: randomUUID(),
          provider,
          eventId,
          eventType: 'callback',
          payload: this.json(payload) ?? Prisma.JsonNull,
          status: InboundWebhookStatus.RECEIVED,
          paymentId,
          signatureValid: true,
        },
      });
      return true;
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      // Unique race: reclaim only if prior attempt failed (never re-process SUCCESS).
      const updated = await this.prisma.inboundWebhookEvent.updateMany({
        where: {
          provider,
          eventId,
          status: {
            in: [InboundWebhookStatus.FAILED, InboundWebhookStatus.RECEIVED],
          },
        },
        data: {
          status: InboundWebhookStatus.RECEIVED,
          paymentId,
          payload: this.json(payload) ?? Prisma.JsonNull,
          errorMessage: null,
          processedAt: null,
        },
      });
      return updated.count > 0;
    }
  }

  public async finalizeCallback(
    providerCode: string,
    eventId: string,
  ): Promise<void> {
    await this.prisma.inboundWebhookEvent.update({
      where: {
        provider_eventId: {
          provider: this.provider(providerCode),
          eventId,
        },
      },
      data: {
        status: InboundWebhookStatus.PROCESSED,
        processedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  public async failCallback(
    providerCode: string,
    eventId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.prisma.inboundWebhookEvent.updateMany({
      where: {
        provider: this.provider(providerCode),
        eventId,
        status: { not: InboundWebhookStatus.PROCESSED },
      },
      data: {
        status: InboundWebhookStatus.FAILED,
        errorMessage: errorMessage.slice(0, 2000),
      },
    });
  }

  private restore(
    row: Awaited<ReturnType<PrismaService['payment']['findFirst']>>,
  ): Payment | null {
    if (!row) return null;
    const publicLifecycle = deriveLifecycle(row.status);
    return Payment.restore({
      id: row.id,
      customerId: row.customerId ?? undefined,
      amount: row.amount,
      currency: row.currency,
      purpose: row.purpose,
      providerCode: row.provider,
      idempotencyKey: row.idempotencyKey ?? `legacy:${row.id}`,
      reference: row.reference ?? row.internalRef ?? undefined,
      lifecycle: fromPersistedLifecycle(row.lifecycleStatus, publicLifecycle),
      expiresAt: row.expiresAt ?? undefined,
      failureCode: row.failureCode ?? undefined,
      failureMessage: row.failureMessage ?? undefined,
      orderId: row.orderId ?? undefined,
      rideId: row.rideId ?? undefined,
      eventBookingId: row.eventBookingId ?? undefined,
      metadata:
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private provider(code: string): PrismaPaymentProvider {
    const normalized = code.toUpperCase();
    if (normalized === 'KOPOKOPO') return PrismaPaymentProvider.KOPOKOPO;
    if (normalized in PrismaPaymentProvider) {
      return normalized as PrismaPaymentProvider;
    }
    return PrismaPaymentProvider.OTHER;
  }

  private resultStatus(
    status: ProviderTransactionRecord['result']['status'],
  ): PaymentStatus {
    if (status === 'COMPLETED') return PaymentStatus.SUCCESS;
    if (status === 'FAILED') return PaymentStatus.FAILED;
    if (status === 'CANCELLED' || status === 'REVERSED') {
      return PaymentStatus.CANCELLED;
    }
    if (status === 'REFUNDED') return PaymentStatus.REFUNDED;
    if (status === 'PARTIALLY_REFUNDED') {
      return PaymentStatus.PARTIALLY_REFUNDED;
    }
    if (status === 'AUTHORISED' || status === 'REQUIRES_ACTION') {
      return PaymentStatus.PROCESSING;
    }
    return PaymentStatus.PENDING;
  }

  private linkedIds(value: ReturnType<Payment['snapshot']>): {
    orderId?: string;
    rideId?: string;
    eventBookingId?: string;
    extra: Record<string, unknown>;
  } {
    return {
      orderId: value.orderId,
      rideId: value.rideId,
      eventBookingId: value.eventBookingId,
      extra: { ...(value.metadata ?? {}) },
    };
  }

  private json(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return value as Prisma.InputJsonValue;
  }
}
