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

interface DarajaCallbackBody {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: Array<{ Name?: string; Value?: unknown }> };
    };
  };
}

@Injectable()
export class DarajaPaymentProvider implements PaymentProvider {
  public readonly code = 'MPESA_DARAJA';
  private readonly http: AxiosInstance;
  private token?: { value: string; expiresAt: number };

  public constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      baseURL: config.get<string>('DARAJA_BASE_URL') ?? 'https://sandbox.safaricom.co.ke',
      timeout: config.get<number>('PAYMENTS_HTTP_TIMEOUT_MS') ?? 10_000,
    });
  }

  public async initiatePayment(command: ProviderCommand): Promise<ProviderResult> {
    this.assertAvailable();
    if (command.currency !== 'KES') throw new Error('Daraja only supports KES');
    if (!command.payerIdentifier) throw new Error('Daraja requires payerIdentifier');
    const timestamp = this.timestamp();
    const shortCode = this.required('DARAJA_SHORT_CODE');
    const passkey = this.required('DARAJA_PASSKEY');
    const response = await this.http.post(
      '/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: shortCode,
        Password: Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64'),
        Timestamp: timestamp,
        TransactionType: this.config.get<string>('DARAJA_TRANSACTION_TYPE') ?? 'CustomerPayBillOnline',
        Amount: this.toKesAmount(command.amount),
        PartyA: command.payerIdentifier,
        PartyB: shortCode,
        PhoneNumber: command.payerIdentifier,
        CallBackURL: command.callbackUrl ?? this.required('DARAJA_CALLBACK_URL'),
        AccountReference: command.reference,
        TransactionDesc: command.description ?? 'DalaDrop payment',
      },
      { headers: await this.authHeaders(command.idempotencyKey) },
    );
    const data = response.data as Record<string, string>;
    return {
      status: data.ResponseCode === '0' ? 'REQUIRES_ACTION' : 'FAILED',
      providerReference: data.MerchantRequestID,
      checkoutReference: data.CheckoutRequestID,
      message: data.CustomerMessage ?? data.ResponseDescription,
      failureCode: data.ResponseCode === '0' ? undefined : data.ResponseCode,
      raw: data,
    };
  }

  public async queryPayment(command: ProviderActionCommand): Promise<ProviderResult> {
    this.assertAvailable();
    const timestamp = this.timestamp();
    const shortCode = this.required('DARAJA_SHORT_CODE');
    const response = await this.http.post(
      '/mpesa/stkpushquery/v1/query',
      {
        BusinessShortCode: shortCode,
        Password: Buffer.from(`${shortCode}${this.required('DARAJA_PASSKEY')}${timestamp}`).toString('base64'),
        Timestamp: timestamp,
        CheckoutRequestID: command.providerReference,
      },
      { headers: await this.authHeaders(command.idempotencyKey) },
    );
    const data = response.data as Record<string, string>;
    return this.resultFromCode(data.ResultCode, data.ResultDesc, command.providerReference, data);
  }

  public async cancelPayment(): Promise<ProviderResult> {
    throw new UnsupportedProviderCapabilityError(this.code, 'cancelling an STK request');
  }

  public async reversePayment(command: ProviderActionCommand): Promise<ProviderResult> {
    return this.submitReversal(command);
  }

  public async refundPayment(command: ProviderActionCommand): Promise<ProviderResult> {
    return this.submitReversal(command);
  }

  /**
   * Validate an inbound STK callback.
   *
   * Official Daraja STK callbacks (CallBackURL) are plain HTTPS POSTs of the
   * stkCallback JSON body — Safaricom does not document callback HMAC headers
   * or an application callback token. See developer.safaricom.co.ke (Daraja /
   * M-Pesa Express).
   *
   * DARAJA_CALLBACK_TOKEN and DARAJA_CALLBACK_SIGNING_SECRET are optional
   * *application* protections (e.g. edge gateway injects `x-callback-token`).
   * When unset, validation accepts a well-formed stkCallback and relies on
   * CheckoutRequestID reconciliation + STK query for production hardening.
   */
  public async validateCallback(input: WebhookInput): Promise<boolean> {
    const callback = (input.body as DarajaCallbackBody)?.Body?.stkCallback;
    if (!callback?.CheckoutRequestID || callback.ResultCode === undefined) {
      return false;
    }

    const signingSecret = this.config.get<string>('DARAJA_CALLBACK_SIGNING_SECRET');
    const signature =
      this.header(input, 'x-daraja-signature') ??
      this.header(input, 'x-callback-signature');
    if (signingSecret) {
      if (!signature || !input.rawBody) return false;
      const timestamp = this.header(input, 'x-daraja-timestamp') ?? '';
      const ok = await this.verifySignature(input.rawBody, signature, timestamp);
      if (!ok) return false;
    }

    const expected = this.config.get<string>('DARAJA_CALLBACK_TOKEN')?.trim();
    if (!expected) return true;
    const supplied = this.header(input, 'x-callback-token');
    return Boolean(supplied && safeEqual(supplied, expected));
  }

  public async handleWebhook(input: WebhookInput): Promise<NormalizedWebhookResult> {
    if (!(await this.validateCallback(input))) throw new InvalidProviderCallbackError();
    const callback = (input.body as DarajaCallbackBody).Body!.stkCallback!;
    const checkoutRequestId = callback.CheckoutRequestID!;
    const items = Object.fromEntries(
      (callback.CallbackMetadata?.Item ?? []).map((item) => [item.Name ?? '', item.Value]),
    );
    const result = this.resultFromCode(
      String(callback.ResultCode),
      callback.ResultDesc,
      checkoutRequestId,
      input.body,
    );
    return {
      ...result,
      eventId: `${checkoutRequestId}:${callback.ResultCode}`,
      paymentReference: callback.MerchantRequestID,
      providerReference: String(items.MpesaReceiptNumber ?? checkoutRequestId),
      occurredAt: input.receivedAt,
      amount: items.Amount === undefined ? undefined : BigInt(Math.round(Number(items.Amount))),
      currency: 'KES',
    };
  }

  public generateReference(paymentId: string): string {
    return deterministicReference('DD', paymentId);
  }

  public async verifySignature(payload: Buffer, signature: string, timestamp = ''): Promise<boolean> {
    const secret = this.config.get<string>('DARAJA_CALLBACK_SIGNING_SECRET');
    if (!secret) return false;
    return safeEqual(createHmac('sha256', secret).update(timestamp).update(payload).digest('hex'), signature);
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
    if (!this.enabled()) return ['provider disabled'];
    // Official STK credentials only. Callback token/signing secret are optional
    // app-layer controls, not Daraja-required fields.
    return [
      'DARAJA_CONSUMER_KEY',
      'DARAJA_CONSUMER_SECRET',
      'DARAJA_SHORT_CODE',
      'DARAJA_PASSKEY',
      'DARAJA_CALLBACK_URL',
    ]
      .filter((key) => !this.config.get<string>(key))
      .map((key) => `${key} missing`);
  }

  private async submitReversal(command: ProviderActionCommand): Promise<ProviderResult> {
    this.assertAvailable();
    if (!command.amount) throw new Error('Reversal amount is required');
    const response = await this.http.post(
      '/mpesa/reversal/v1/request',
      {
        Initiator: this.required('DARAJA_INITIATOR_NAME'),
        SecurityCredential: this.required('DARAJA_SECURITY_CREDENTIAL'),
        CommandID: 'TransactionReversal',
        TransactionID: command.providerReference,
        Amount: this.toKesAmount(command.amount),
        ReceiverParty: this.required('DARAJA_SHORT_CODE'),
        RecieverIdentifierType: '11',
        ResultURL: this.required('DARAJA_REVERSAL_RESULT_URL'),
        QueueTimeOutURL: this.required('DARAJA_REVERSAL_TIMEOUT_URL'),
        Remarks: command.reason ?? 'Payment reversal',
        Occasion: command.paymentId,
      },
      { headers: await this.authHeaders(command.idempotencyKey) },
    );
    const data = response.data as Record<string, string>;
    return {
      status: data.ResponseCode === '0' ? 'PENDING' : 'FAILED',
      providerReference: data.ConversationID ?? command.providerReference,
      failureCode: data.ResponseCode === '0' ? undefined : data.ResponseCode,
      message: data.ResponseDescription,
      raw: data,
    };
  }

  private async authHeaders(idempotencyKey: string): Promise<Record<string, string>> {
    return { Authorization: `Bearer ${await this.accessToken()}`, 'Idempotency-Key': idempotencyKey };
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) return this.token.value;
    const credentials = Buffer.from(
      `${this.required('DARAJA_CONSUMER_KEY')}:${this.required('DARAJA_CONSUMER_SECRET')}`,
    ).toString('base64');
    const response = await this.http.get('/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${credentials}` },
    });
    const data = response.data as { access_token: string; expires_in?: string };
    this.token = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in ?? 3599) * 1000 };
    return data.access_token;
  }

  private resultFromCode(code: string, message: string | undefined, reference: string, raw: unknown): ProviderResult {
    if (code === '0') return { status: 'COMPLETED', providerReference: reference, message, raw };
    if (code === '1032') return { status: 'CANCELLED', providerReference: reference, message, raw };
    if (code === '1037' || code === '1') return { status: 'PENDING', providerReference: reference, message, raw };
    return { status: 'FAILED', providerReference: reference, failureCode: code, message, raw };
  }

  private toKesAmount(amount: bigint): number {
    if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount exceeds provider limit');
    return Number(amount);
  }

  private timestamp(): string {
    return new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  }

  private enabled(): boolean {
    return this.config.get<string>('DARAJA_ENABLED') === 'true';
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
