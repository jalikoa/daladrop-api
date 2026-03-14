export interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<EmailResponse>;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}
