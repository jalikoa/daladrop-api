export interface IDarajaAdapter {
  getAccessToken(): Promise<string>;
  stkPush(request: StkPushRequest): Promise<StkPushResponse>;
  queryStkStatus(checkoutRequestId: string): Promise<StkStatusResponse>;
  validateCallbackSignature(payload: unknown, signature: string): boolean;
}

export interface StkPushRequest {
  phone: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  callbackUrl: string;
}

export interface StkPushResponse {
  merchantRequestID: string;
  checkoutRequestID: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export interface StkStatusResponse {
  resultCode: string;
  resultDesc: string;
  amount?: number;
  mpesaReceiptNumber?: string;
  transactionDate?: string;
  phoneNumber?: string;
}
