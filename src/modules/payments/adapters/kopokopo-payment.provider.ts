import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';
import {
  deterministicReference,
  InvalidProviderCallbackError,
  type NormalizedWebhookResult,
  type PaymentProvider,
  type ProviderActionCommand,
  type ProviderCommand,
  type ProviderHealth,
  type ProviderResult,
  ProviderUnavailableError,
  safeEqual,
  UnsupportedProviderCapabilityError,
  type WebhookInput,
} from '../domain/payment-provider';

@Injectable()
export class KopoKopoPaymentProvider implements PaymentProvider {
  public readonly code = 'KOPOKOPO';
  private readonly http: AxiosInstance;
  private token?: { value: string; expiresAt: number };

  public constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      baseURL: config.get<string>('KOPOKOPO_BASE_URL') ?? 'https://sandbox.kopokopo.com',
      timeout: config.get<number>('PAYMENTS_HTTP_TIMEOUT_MS') ?? 10_000,
    });
  }

  public async initiatePayment(command: ProviderCommand): Promise<ProviderResult> {
    this.assertAvailable();
    if (command.currency !== 'KES') throw new Error('KopoKopo only supports KES');
    if (!command.payerIdentifier) throw new Error('KopoKopo requires payerIdentifier');
    const response = await this.http.post(
      '/api/v1/incoming_payments',
      {
        payment_channel: 'M-PESA',
        till_number: this.required('KOPOKOPO_TILL_NUMBER'),
        subscriber: { phone_number: command.payerIdentifier },
        amount: { currency: 'KES', value: command.amount.toString() },
        metadata: { payment_id: command.paymentId, reference: command.reference, ...command.metadata },
        callback_url: command.callbackUrl ?? this.required('KOPOKOPO_CALLBACK_URL'),
      },
      { headers: await this.headers(command.idempotencyKey) },
    );
    const location = String(response.headers.location ?? '');
    const reference = location.split('/').filter(Boolean).at(-1);
    return {
      status: 'REQUIRES_ACTION',
      providerReference: reference,
      message: 'Payment request accepted',
      raw: response.data,
    };
  }

  public async queryPayment(command: ProviderActionCommand): Promise<ProviderResult> {
    this.assertAvailable();
    const response = await this.http.get(`/api/v1/incoming_payments/${encodeURIComponent(command.providerReference)}`, {
      headers: await this.headers(command.idempotencyKey),
    });
    return this.mapResult(response.data as Record<string, unknown>, command.providerReference);
  }

  public async cancelPayment(): Promise<ProviderResult> {
    throw new UnsupportedProviderCapabilityError(this.code, 'cancel payment');
  }

  public async reversePayment(): Promise<ProviderResult> {
    throw new UnsupportedProviderCapabilityError(this.code, 'transaction reversal');
  }

  public async refundPayment(command: ProviderActionCommand): Promise<ProviderResult> {
    this.assertAvailable();
    if (!command.amount || !command.currency) throw new Error('Refund amount and currency are required');
    const response = await this.http.post(
      '/api/v1/refunds',
      {
        transaction_reference: command.providerReference,
        amount: { currency: command.currency, value: command.amount.toString() },
        reason: command.reason ?? 'Customer refund',
        metadata: { payment_id: command.paymentId, ...command.metadata },
        callback_url: this.required('KOPOKOPO_CALLBACK_URL'),
      },
      { headers: await this.headers(command.idempotencyKey) },
    );
    const reference = String(response.headers.location ?? '').split('/').filter(Boolean).at(-1);
    return { status: 'PENDING', providerReference: reference ?? command.providerReference, raw: response.data };
  }

  public async validateCallback(input: WebhookInput): Promise<boolean> {
    const signature = this.header(input, 'x-kopokopo-signature');
    const timestamp = this.header(input, 'x-kopokopo-timestamp') ?? '';
    if (!signature || !input.rawBody) return false;
    return this.verifySignature(input.rawBody, signature, timestamp);
  }

  public async handleWebhook(input: WebhookInput): Promise<NormalizedWebhookResult> {
    if (!(await this.validateCallback(input))) throw new InvalidProviderCallbackError();
    const body = input.body as Record<string, any>;
    const data = (body.data ?? body) as Record<string, any>;
    const reference = String(data.id ?? data.resource_id ?? data.reference ?? '');
    if (!reference) throw new InvalidProviderCallbackError('KopoKopo callback has no event reference');
    const result = this.mapResult(data, reference);
    const amountValue = data.amount?.value ?? data.amount;
    return {
      ...result,
      eventId: String(body.id ?? `${reference}:${data.status}`),
      paymentReference: data.metadata?.payment_id,
      occurredAt: data.created_at ? new Date(data.created_at) : input.receivedAt,
      amount: amountValue === undefined ? undefined : BigInt(String(amountValue)),
      currency: data.amount?.currency ?? data.currency ?? 'KES',
    };
  }

  public generateReference(paymentId: string): string {
    return deterministicReference('KK', paymentId);
  }

  public async verifySignature(payload: Buffer, signature: string, timestamp = ''): Promise<boolean> {
    const secret = this.config.get<string>('KOPOKOPO_WEBHOOK_SECRET');
    if (!secret) return false;
    const digest = createHmac('sha256', secret).update(timestamp).update(payload).digest('hex');
    return safeEqual(digest, signature.replace(/^sha256=/, ''));
  }

  public async healthCheck(): Promise<ProviderHealth> {
    const errors = this.validateConfiguration();
    if (errors.length) return { available: false, providerCode: this.code, reason: errors.join(', ') };
    try {
      await this.accessToken();
      return { available: true, providerCode: this.code };
    } catch (error) {
      return { available: false, providerCode: this.code, reason: (error as Error).message };
    }
  }

  public validateConfiguration(): readonly string[] {
    if (this.config.get<string>('KOPOKOPO_ENABLED') !== 'true') return ['provider disabled'];
    return ['KOPOKOPO_CLIENT_ID', 'KOPOKOPO_CLIENT_SECRET', 'KOPOKOPO_TILL_NUMBER', 'KOPOKOPO_CALLBACK_URL', 'KOPOKOPO_WEBHOOK_SECRET']
      .filter((key) => !this.config.get<string>(key))
      .map((key) => `${key} missing`);
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) return this.token.value;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.required('KOPOKOPO_CLIENT_ID'),
      client_secret: this.required('KOPOKOPO_CLIENT_SECRET'),
    });
    const response = await this.http.post('/oauth/token', body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const data = response.data as { access_token: string; expires_in?: number };
    this.token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return data.access_token;
  }

  private async headers(idempotencyKey: string): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${await this.accessToken()}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    };
  }

  private mapResult(data: Record<string, any>, reference: string): ProviderResult {
    const status = String(data.status ?? data.attributes?.status ?? '').toLowerCase();
    const mapped =
      status === 'success' || status === 'completed'
        ? 'COMPLETED'
        : status === 'failed'
          ? 'FAILED'
          : status === 'cancelled'
            ? 'CANCELLED'
            : status === 'refunded'
              ? 'REFUNDED'
              : 'PENDING';
    return {
      status: mapped,
      providerReference: reference,
      failureCode: mapped === 'FAILED' ? String(data.error_code ?? 'PROVIDER_FAILED') : undefined,
      message: data.message,
      raw: data,
    };
  }

  private assertAvailable(): void {
    const errors = this.validateConfiguration();
    if (errors.length) throw new ProviderUnavailableError(this.code, errors.join(', '));
  }

  private required(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) throw new ProviderUnavailableError(this.code, `${key} missing`);
    return value;
  }

  private header(input: WebhookInput, name: string): string | undefined {
    const value = input.headers[name] ?? input.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }
}
