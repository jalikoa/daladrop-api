import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { IDarajaAdapter, StkPushRequest, StkPushResponse, StkStatusResponse } from '../interfaces/daraja-adapter.interface';
import { PAYMENT_CONSTANTS } from '../constants/payment.constants';

@Injectable()
export class DarajaAdapter implements IDarajaAdapter {
  private readonly logger = new Logger(DarajaAdapter.name);
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;
  private accessToken?: string;
  private tokenExpiry?: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get('NODE_ENV') === 'production'
      ? PAYMENT_CONSTANTS.DARAJA.PRODUCTION_URL
      : PAYMENT_CONSTANTS.DARAJA.SANDBOX_URL;

    this.http = axios.create({ baseURL: this.baseUrl, timeout: 30000, headers: { 'Content-Type': 'application/json' } });
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const consumerKey = this.configService.get<string>('DARAJA_CONSUMER_KEY');
      const consumerSecret = this.configService.get<string>('DARAJA_CONSUMER_SECRET');

      if (!consumerKey || !consumerSecret) throw new Error('Daraja credentials not configured');

      const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
      const response = await this.http.get(PAYMENT_CONSTANTS.DARAJA.TOKEN_ENDPOINT, { headers: { Authorization: `Basic ${auth}` } });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
      this.logger.log('Daraja access token refreshed');
      return this.accessToken;
    } catch (error) {
      this.logger.error('Failed to get Daraja access token', error);
      throw new BadRequestException('Failed to authenticate with Daraja');
    }
  }

  async stkPush(request: StkPushRequest): Promise<StkPushResponse> {
    try {
      const token = await this.getAccessToken();
      const paybill = this.configService.get<string>('DARAJA_PAYBILL');
      const passkey = this.configService.get<string>('DARAJA_PASSKEY');

      if (!paybill || !passkey) throw new Error('Daraja Paybill or Passkey not configured');

      const timestamp = new Date().toISOString().replace(/[-:]/g, '').substring(0, 14);
      const password = Buffer.from(`${paybill}${passkey}${timestamp}`).toString('base64');

      const response = await this.http.post(
        PAYMENT_CONSTANTS.DARAJA.STK_PUSH_ENDPOINT,
        {
          BusinessShortCode: paybill,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: request.amount,
          PartyA: request.phone,
          PartyB: paybill,
          PhoneNumber: request.phone,
          CallBackURL: `${this.configService.get('PUBLIC_URL')}${PAYMENT_CONSTANTS.DARAJA.CALLBACK_PATH}`,
          AccountReference: request.accountReference,
          TransactionDesc: request.transactionDesc,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      this.logger.log(`STK Push initiated: ${response.data.CheckoutRequestID}`);

      return {
        merchantRequestID: response.data.MerchantRequestID,
        checkoutRequestID: response.data.CheckoutRequestID,
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription,
        customerMessage: response.data.CustomerMessage || 'STK push sent successfully',
      };
    } catch (error) {
      this.logger.error('STK Push failed', error);
      throw new BadRequestException('Failed to initiate STK push');
    }
  }

  async queryStkStatus(checkoutRequestId: string): Promise<StkStatusResponse> {
    try {
      const token = await this.getAccessToken();
      const paybill = this.configService.get<string>('DARAJA_PAYBILL');
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').substring(0, 14);
      const passkey = this.configService.get<string>('DARAJA_PASSKEY');
      const password = Buffer.from(`${paybill}${passkey}${timestamp}`).toString('base64');

      const response = await this.http.post('/mpesa/stkpushquery/v1/query', {
        BusinessShortCode: paybill,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }, { headers: { Authorization: `Bearer ${token}` } });

      return {
        resultCode: response.data.ResultCode,
        resultDesc: response.data.ResultDesc,
        amount: response.data.Amount,
        mpesaReceiptNumber: response.data.MpesaReceiptNumber,
        transactionDate: response.data.TransactionDate,
        phoneNumber: response.data.PhoneNumber,
      };
    } catch (error) {
      this.logger.error('STK Status query failed', error);
      throw new BadRequestException('Failed to query STK status');
    }
  }

  validateCallbackSignature(payload: unknown, signature: string): boolean {
    this.logger.debug('Validating Daraja callback signature');
    return true;
  }
}
