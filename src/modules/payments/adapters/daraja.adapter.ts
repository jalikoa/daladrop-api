import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
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

      if (!consumerKey || !consumerSecret) {
        throw new InternalServerErrorException('Daraja credentials not configured');
      }

      const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
      const response = await this.http.get(PAYMENT_CONSTANTS.DARAJA.TOKEN_ENDPOINT, {
        headers: { Authorization: `Basic ${auth}` },
      });

      const token: string = response.data.access_token;
      this.accessToken = token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
      return token;
    } catch (error: any) {
      this.logger.error('Failed to get Daraja access token', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new BadRequestException('Failed to authenticate with Daraja');
    }
  }

  async stkPush(request: StkPushRequest): Promise<StkPushResponse> {
    try {
      const token = await this.getAccessToken();
      const paybill = this.configService.get<string>('DARAJA_PAYBILL');
      const passkey = this.configService.get<string>('DARAJA_PASSKEY');

      if (!paybill || !passkey) {
        throw new InternalServerErrorException('Daraja paybill or passkey not configured');
      }

      const timestamp = new Date().toISOString().replace(/[-:]/g, '').substring(0, 14);
      const password = Buffer.from(`${paybill}${passkey}${timestamp}`).toString('base64');
      const publicUrl = this.configService.get<string>('PUBLIC_URL') || '';
      const callbackUrl = `${publicUrl}${PAYMENT_CONSTANTS.DARAJA.CALLBACK_PATH}`;

      const requestBody = {
        BusinessShortCode: paybill,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: request.amount,
        PartyA: request.phone,
        PartyB: paybill,
        PhoneNumber: request.phone,
        CallBackURL: callbackUrl,
        AccountReference: request.accountReference,
        TransactionDesc: request.transactionDesc,
      };

      this.logger.debug('Daraja STK Push request', {
        phone: request.phone,
        amount: request.amount,
        callback: callbackUrl,
        timestamp,
      });

      const response = await this.http.post(
        PAYMENT_CONSTANTS.DARAJA.STK_PUSH_ENDPOINT,
        requestBody,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      this.logger.debug('Daraja STK Push response', {
        status: response.status,
        data: response.data,
      });

      if (response.data.ResponseCode !== '0') {
        this.logger.error('Daraja rejected STK push', {
          responseCode: response.data.ResponseCode,
          responseDescription: response.data.ResponseDescription,
          customerMessage: response.data.CustomerMessage,
          requestBody: { phone: request.phone, amount: request.amount },
        });
        throw new BadRequestException(
          `Daraja error: ${response.data.ResponseDescription || response.data.CustomerMessage || 'Unknown'}`,
        );
      }

      return {
        merchantRequestID: response.data.MerchantRequestID,
        checkoutRequestID: response.data.CheckoutRequestID,
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription,
        customerMessage: response.data.CustomerMessage || 'STK push sent successfully',
      };
    } catch (error: any) {
      const darajaError = error.response?.data || error.message;
      this.logger.error('STK Push failed', {
        message: error.message,
        status: error.response?.status,
        darajaResponse: darajaError,
        phone: request.phone,
        amount: request.amount,
      });
      const errorMsg = darajaError?.ResponseDescription || darajaError?.CustomerMessage || error.message;
      throw new BadRequestException(`Failed to initiate STK push: ${errorMsg}`);
    }
  }

  async queryStkStatus(checkoutRequestId: string): Promise<StkStatusResponse> {
    try {
      const token = await this.getAccessToken();
      const paybill = this.configService.get<string>('DARAJA_PAYBILL');
      const passkey = this.configService.get<string>('DARAJA_PASSKEY');
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').substring(0, 14);
      const password = Buffer.from(`${paybill}${passkey}${timestamp}`).toString('base64');

      const response = await this.http.post(
        '/mpesa/stkpushquery/v1/query',
        {
          BusinessShortCode: paybill,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      return {
        resultCode: response.data.ResultCode,
        resultDesc: response.data.ResultDesc,
        amount: response.data.Amount,
        mpesaReceiptNumber: response.data.MpesaReceiptNumber,
        transactionDate: response.data.TransactionDate,
        phoneNumber: response.data.PhoneNumber,
      };
    } catch (error: any) {
      this.logger.error('STK Status query failed', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        checkoutRequestId,
      });
      throw new BadRequestException('Failed to query STK status');
    }
  }

  validateCallbackSignature(payload: unknown, signature: string): boolean {
    return true;
  }
}