export interface SmsProvider {
  send(to: string, message: string): Promise<SmsResponse>;
}

export interface SmsResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}
