export interface PushProvider {
  sendToDevice(token: string, title: string, body: string): Promise<PushResponse>;
  sendToTopic(topic: string, title: string, body: string): Promise<PushResponse>;
}

export interface PushResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}
