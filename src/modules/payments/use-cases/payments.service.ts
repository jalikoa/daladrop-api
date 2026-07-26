import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActorType, AuditAction, Prisma, RefundStatus, type Refund } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { kesFromBigInt, kesZero } from '../../../shared/money';
import { AuditLogService } from '../../operations/use-cases/audit-log.service';
import { Payment, type PaymentLifecycle, type PublicPaymentStatus } from '../domain/payment';
import type {
  NormalizedWebhookResult,
  ProviderActionCommand,
  ProviderResult,
  WebhookInput,
} from '../domain/payment-provider';
import { PaymentProviderRegistry } from '../adapters/provider-registry';
import {
  PAYMENT_REPOSITORY,
  type PaymentListQuery,
  type PaymentRepository,
} from '../repositories/payment.repository';
import {
  PAYMENT_OUTBOX,
  type PaymentOutboxPort,
} from '../events/payment-outbox.port';

export interface CreatePaymentInput {
  readonly customerId: string;
  readonly amount: bigint;
  readonly currency: string;
  readonly purpose: string;
  readonly providerCode: string;
  readonly payerIdentifier?: string;
  readonly description?: string;
  readonly idempotencyKey: string;
  readonly callbackUrl?: string;
  readonly orderId?: string;
  readonly rideId?: string;
  readonly eventBookingId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

@Injectable()
export class PaymentsService {
  public constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly repository: PaymentRepository,
    @Inject(PAYMENT_OUTBOX) private readonly outbox: PaymentOutboxPort,
    private readonly registry: PaymentProviderRegistry,
    private readonly audit: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  public async createAndInitiate(input: CreatePaymentInput): Promise<ReturnType<PaymentsService['view']>> {
    if (!input.idempotencyKey?.trim()) throw new Error('Idempotency key is required');
    const existing = await this.repository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      this.assertOwner(existing, input.customerId);
      return this.view(existing);
    }
    const provider = this.registry.get(input.providerCode);
    const paymentId = randomUUID();
    const payment = Payment.create({
      id: paymentId,
      customerId: input.customerId,
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      purpose: input.purpose,
      providerCode: provider.code,
      idempotencyKey: input.idempotencyKey,
      reference: provider.generateReference(paymentId),
      expiresAt: new Date(Date.now() + 15 * 60_000),
      orderId: input.orderId,
      rideId: input.rideId,
      eventBookingId: input.eventBookingId,
      metadata: input.metadata,
    });
    payment.transition('INITIATION_PENDING');
    await this.repository.save(payment);
    await this.publish(payment);
    const snapshot = payment.snapshot();

    let result: ProviderResult;
    try {
      result = await provider.initiatePayment({
        paymentId: snapshot.id,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        idempotencyKey: input.idempotencyKey,
        reference: snapshot.reference!,
        customerId: input.customerId,
        payerIdentifier: input.payerIdentifier,
        callbackUrl: input.callbackUrl,
        description: input.description,
      });
      this.applyProviderResult(payment, result);
    } catch (error) {
      payment.markFailure(
        (error as { code?: string }).code ?? 'PROVIDER_ERROR',
        (error as Error).message,
      );
      await this.repository.save(payment);
      await this.publish(payment);
      throw error;
    }
    await this.repository.saveProviderTransaction({
      id: randomUUID(),
      paymentId: snapshot.id,
      providerCode: provider.code,
      providerReference: result.providerReference,
      checkoutReference: result.checkoutReference,
      payerIdentifier: input.payerIdentifier,
      request: { idempotencyKey: input.idempotencyKey, payerIdentifier: input.payerIdentifier },
      result,
    });
    await this.repository.save(payment);
    await this.publish(payment);
    await this.audit.record({
      tableName: 'payments',
      recordId: snapshot.id,
      action: AuditAction.INSERT,
      actorId: input.customerId,
      actorType: ActorType.USER,
      afterData: this.view(payment),
    });
    return this.viewWithCheckout(payment);
  }

  public async getForCustomer(id: string, customerId: string) {
    const payment = await this.required(id);
    this.assertOwner(payment, customerId);
    return this.view(payment);
  }

  public async getAdmin(id: string) {
    return this.view(await this.required(id));
  }

  public async listAdmin(query: PaymentListQuery) {
    return Promise.all((await this.repository.list(query)).map((payment) => this.view(payment)));
  }

  public async queryAndSync(id: string, customerId?: string) {
    const payment = await this.required(id);
    if (customerId) this.assertOwner(payment, customerId);
    this.assertNotExpired(payment);
    const result = await this.callProvider(payment, 'query', `query:${id}:${Date.now()}`);
    this.applyProviderResult(payment, result);
    await this.repository.save(payment);
    await this.publish(payment);
    return this.view(payment);
  }

  public async retry(id: string, customerId: string, idempotencyKey: string) {
    const payment = await this.required(id);
    this.assertOwner(payment, customerId);
    if (!['FAILED', 'EXPIRED'].includes(payment.snapshot().lifecycle)) {
      throw new ConflictException('Only failed or expired payments can be retried');
    }
    payment.transition('INITIATION_PENDING');
    const provider = this.registry.get(payment.snapshot().providerCode);
    const value = payment.snapshot();
    const payerIdentifier = await this.repository.latestPayerIdentifier(value.id);
    const result = await provider.initiatePayment({
      paymentId: value.id,
      amount: value.amount,
      currency: value.currency,
      idempotencyKey,
      reference: value.reference!,
      customerId,
      payerIdentifier: payerIdentifier ?? undefined,
    });
    this.applyProviderResult(payment, result);
    await this.persistAction(payment, result, idempotencyKey);
    return this.view(payment);
  }

  public async cancel(id: string, actorId: string, idempotencyKey: string) {
    return this.mutate(id, actorId, idempotencyKey, 'cancel');
  }

  public async reverse(id: string, actorId: string, idempotencyKey: string, reason?: string) {
    return this.mutate(id, actorId, idempotencyKey, 'reverse', undefined, reason, true);
  }

  public async refund(
    id: string,
    actorId: string,
    idempotencyKey: string,
    amount: bigint,
    reason?: string,
  ) {
    if (amount <= 0n) throw new Error('Refund amount must be greater than zero');
    if (!idempotencyKey?.trim()) throw new Error('Idempotency key is required');

    const idemRef = `idem:${idempotencyKey.trim()}`;
    const existingRefund = await this.prisma.refund.findFirst({
      where: { paymentId: id, providerRef: idemRef },
    });
    if (existingRefund) {
      const payment = await this.required(id);
      return { ...this.view(payment), refund: this.refundView(existingRefund) };
    }

    const payment = await this.required(id);
    const value = payment.snapshot();
    if (!['CAPTURED', 'PARTIALLY_REFUNDED'].includes(value.lifecycle)) {
      throw new ConflictException(
        `Payment cannot be refunded while ${value.lifecycle}`,
      );
    }

    // Lock the payment row while summing open refunds + inserting the new one
    // so concurrent refunds cannot overshoot the captured amount.
    const refund = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM payments WHERE id = ${id}::uuid FOR UPDATE
      `;
      await this.assertRefundable(id, value.amount, amount, tx);
      return tx.refund.create({
        data: {
          paymentId: id,
          status: RefundStatus.PROCESSING,
          amount,
          currency: value.currency,
          reason: reason ?? null,
          providerRef: idemRef,
        },
      });
    });

    payment.transition('REFUND_PENDING');

    let result: ProviderResult;
    try {
      result = await this.callProvider(payment, 'refund', idempotencyKey, amount, reason);
    } catch (error) {
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: { status: RefundStatus.FAILED },
      });
      throw error;
    }

    if (result.status === 'REFUNDED' || result.status === 'PARTIALLY_REFUNDED') {
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.SUCCEEDED,
          completedAt: new Date(),
          providerRef: result.providerReference ?? refund.providerRef,
        },
      });
    } else if (result.status === 'FAILED') {
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: { status: RefundStatus.FAILED },
      });
    }

    this.applyProviderResult(payment, result, {
      refundId: refund.id,
      refundAmount: amount.toString(),
    });
    await this.persistAction(payment, result, idempotencyKey);
    await this.auditChange(payment, actorId, reason ?? 'refund');

    const finalRefund = await this.prisma.refund.findUniqueOrThrow({
      where: { id: refund.id },
    });
    return { ...this.view(payment), refund: this.refundView(finalRefund) };
  }

  public async listRefunds(paymentId: string) {
    const rows = await this.prisma.refund.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true as const, items: rows.map((row) => this.refundView(row)) };
  }

  public async getRefund(id: string) {
    const row = await this.prisma.refund.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Refund not found');
    return { success: true as const, refund: this.refundView(row) };
  }

  public async manualApprove(id: string, adminId: string, idempotencyKey: string) {
    const payment = await this.required(id);
    if (payment.snapshot().providerCode !== 'MANUAL') {
      throw new ConflictException('Only manual payments can be manually approved');
    }
    if (!['INITIATION_PENDING', 'AWAITING_CUSTOMER'].includes(payment.snapshot().lifecycle)) {
      throw new ConflictException('Manual payment is not awaiting approval');
    }
    payment.transition('AUTHORISED', { adminId, idempotencyKey });
    payment.transition('CAPTURED', { adminId, idempotencyKey });
    await this.repository.save(payment);
    await this.publish(payment);
    await this.auditChange(payment, adminId, 'manual approval');
    return this.view(payment);
  }

  public async handleWebhook(providerCode: string, input: WebhookInput) {
    const provider = this.registry.get(providerCode);
    const callback = await provider.handleWebhook(input);
    if (await this.repository.hasProcessedCallback(provider.code, callback.eventId)) {
      return { duplicate: true, accepted: true };
    }
    const payment = await this.resolveCallbackPayment(callback);
    const claimed = await this.repository.claimCallback(
      provider.code,
      callback.eventId,
      payment.snapshot().id,
      input.body,
    );
    if (!claimed) return { duplicate: true, accepted: true };
    try {
      this.applyProviderResult(payment, callback);
      await this.repository.save(payment);
      await this.publish(payment);
      await this.repository.finalizeCallback(provider.code, callback.eventId);
      await this.auditChange(payment, undefined, `provider callback ${callback.eventId}`);
      return { duplicate: false, accepted: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Webhook apply failed';
      await this.repository
        .failCallback(provider.code, callback.eventId, message)
        .catch(() => undefined);
      throw error;
    }
  }

  private async mutate(
    id: string,
    actorId: string,
    idempotencyKey: string,
    action: 'cancel' | 'reverse' | 'refund',
    amount?: bigint,
    reason?: string,
    admin = false,
  ) {
    if (!idempotencyKey.trim()) throw new Error('Idempotency key is required');
    const payment = await this.required(id);
    if (!admin) this.assertOwner(payment, actorId);
    if (action === 'reverse' && payment.snapshot().lifecycle === 'CAPTURED') {
      payment.transition('REVERSAL_PENDING');
    }
    if (
      action === 'refund' &&
      ['CAPTURED', 'PARTIALLY_REFUNDED'].includes(payment.snapshot().lifecycle)
    ) {
      payment.transition('REFUND_PENDING');
    }
    const result = await this.callProvider(payment, action, idempotencyKey, amount, reason);
    this.applyProviderResult(payment, result);
    await this.persistAction(payment, result, idempotencyKey);
    await this.auditChange(payment, actorId, reason ?? action);
    return this.view(payment);
  }

  private async callProvider(
    payment: Payment,
    action: 'query' | 'cancel' | 'reverse' | 'refund',
    idempotencyKey: string,
    amount?: bigint,
    reason?: string,
  ): Promise<ProviderResult> {
    const value = payment.snapshot();
    const reference = await this.repository.latestProviderReference(value.id);
    if (!reference) throw new ConflictException('Payment has no provider reference');
    const command: ProviderActionCommand = {
      paymentId: value.id,
      providerReference: reference,
      idempotencyKey,
      amount,
      currency: value.currency,
      reason,
    };
    const provider = this.registry.get(value.providerCode);
    if (action === 'query') return provider.queryPayment(command);
    if (action === 'cancel') return provider.cancelPayment(command);
    if (action === 'reverse') return provider.reversePayment(command);
    return provider.refundPayment(command);
  }

  private applyProviderResult(
    payment: Payment,
    result: ProviderResult,
    extraDetails: Record<string, unknown> = {},
  ): void {
    if (
      result.status === 'PENDING' &&
      ['REVERSAL_PENDING', 'REFUND_PENDING'].includes(payment.snapshot().lifecycle)
    ) {
      return;
    }
    const target: Partial<Record<ProviderResult['status'], PaymentLifecycle>> = {
      PENDING: 'AWAITING_CUSTOMER',
      REQUIRES_ACTION: 'AWAITING_CUSTOMER',
      AUTHORISED: 'AUTHORISED',
      COMPLETED: 'CAPTURED',
      FAILED: 'FAILED',
      CANCELLED: 'CANCELLED',
      REVERSED: 'REVERSED',
      PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
      REFUNDED: 'REFUNDED',
    };
    const next = target[result.status];
    if (!next || payment.snapshot().lifecycle === next) return;
    if (next === 'REVERSED' && payment.snapshot().lifecycle === 'CAPTURED') {
      payment.transition('REVERSAL_PENDING');
    }
    if ((next === 'REFUNDED' || next === 'PARTIALLY_REFUNDED') && payment.snapshot().lifecycle === 'CAPTURED') {
      payment.transition('REFUND_PENDING');
    }
    payment.transition(next, {
      ...extraDetails,
      providerReference: result.providerReference,
      failureCode: result.failureCode,
      message: result.message,
    });
  }

  /** Sums PENDING/PROCESSING/SUCCEEDED refunds and rejects if the new amount overshoots the payment. */
  private async assertRefundable(
    paymentId: string,
    paymentAmount: bigint,
    amount: bigint,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const rows = await client.refund.findMany({
      where: {
        paymentId,
        status: {
          in: [RefundStatus.SUCCEEDED, RefundStatus.PROCESSING, RefundStatus.PENDING],
        },
      },
      select: { amount: true },
    });
    let alreadyRefunded = kesZero();
    for (const row of rows) {
      alreadyRefunded = alreadyRefunded.add(kesFromBigInt(row.amount));
    }
    const requested = alreadyRefunded.add(kesFromBigInt(amount));
    if (requested.compareTo(kesFromBigInt(paymentAmount)) > 0) {
      throw new BadRequestException(
        'Refund amount exceeds the remaining refundable balance',
      );
    }
  }

  private refundView(row: Refund) {
    return {
      id: row.id,
      paymentId: row.paymentId,
      status: row.status,
      amount: row.amount.toString(),
      currency: row.currency,
      reason: row.reason,
      providerRef: row.providerRef,
      journalEntryId: row.journalEntryId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
    };
  }

  private async persistAction(payment: Payment, result: ProviderResult, idempotencyKey: string): Promise<void> {
    await this.repository.saveProviderTransaction({
      id: randomUUID(),
      paymentId: payment.snapshot().id,
      providerCode: payment.snapshot().providerCode,
      providerReference: result.providerReference,
      request: { idempotencyKey },
      result,
    });
    await this.repository.save(payment);
    await this.publish(payment);
  }

  private async resolveCallbackPayment(result: NormalizedWebhookResult): Promise<Payment> {
    const reference = result.paymentReference ?? result.providerReference;
    if (!reference) throw new NotFoundException('Callback has no payment reference');
    const payment =
      (await this.repository.findByReference(reference)) ??
      (await this.repository.findByProviderReference(reference)) ??
      (result.providerReference
        ? await this.repository.findByProviderReference(result.providerReference)
        : null);
    if (!payment) throw new NotFoundException('Callback payment was not found');
    return payment;
  }

  private async required(id: string): Promise<Payment> {
    const payment = await this.repository.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  private assertOwner(payment: Payment, customerId: string): void {
    if (payment.snapshot().customerId !== customerId) throw new ForbiddenException('Payment access denied');
  }

  private assertNotExpired(payment: Payment): void {
    const value = payment.snapshot();
    if (value.expiresAt && value.expiresAt <= new Date() && ['INITIATION_PENDING', 'AWAITING_CUSTOMER'].includes(value.lifecycle)) {
      payment.transition('EXPIRED', { reason: 'payment expired' });
      throw new ConflictException('Payment has expired');
    }
  }

  private async publish(payment: Payment): Promise<void> {
    const value = payment.snapshot();
    const events = payment.pullEvents().map((event) => ({
      ...event,
      payload: {
        ...event.payload,
        purpose: value.purpose,
        providerCode: value.providerCode,
        status: payment.publicStatus,
        lifecycle: value.lifecycle,
        orderId: value.orderId,
        rideId: value.rideId,
        eventBookingId: value.eventBookingId,
        amount: value.amount.toString(),
        currency: value.currency,
        customerId: value.customerId,
      },
    }));
    await this.outbox.publish(events);
  }

  private async auditChange(payment: Payment, actorId: string | undefined, reason: string): Promise<void> {
    await this.audit.record({
      tableName: 'payments',
      recordId: payment.snapshot().id,
      action: AuditAction.STATUS_CHANGE,
      actorId,
      actorType: actorId ? ActorType.ADMIN : ActorType.SERVICE,
      afterData: this.view(payment),
      reason,
    });
  }

  private view(payment: Payment) {
    const value = payment.snapshot();
    return {
      id: value.id,
      customerId: value.customerId,
      amount: value.amount.toString(),
      currency: value.currency,
      purpose: value.purpose,
      providerCode: value.providerCode,
      reference: value.reference,
      lifecycle: value.lifecycle,
      status: payment.publicStatus,
      failureCode: value.failureCode,
      failureMessage: value.failureMessage,
      orderId: value.orderId,
      rideId: value.rideId,
      eventBookingId: value.eventBookingId,
      checkoutRequestId: undefined as string | undefined,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  }

  public async viewWithCheckout(payment: Payment) {
    const base = this.view(payment);
    const checkoutRequestId = await this.repository.latestProviderReference(
      payment.snapshot().id,
    );
    return { ...base, checkoutRequestId: checkoutRequestId ?? undefined };
  }
}
