import type {
  SmsMessage,
  SmsProvider,
  SmsSendResult,
} from '../../../platform/messaging/sms/sms-provider.interface';
import type { HttpClient } from '../../../platform/messaging/webhooks/webhook.types';

export interface AfricasTalkingSmsProviderOptions {
  readonly username: string;
  readonly apiKey: string;
  readonly client: HttpClient;
  /** Live: https://api.africastalking.com — Sandbox: https://api.sandbox.africastalking.com */
  readonly baseUrl?: string;
  /** Optional registered sender ID / shortcode. Omit on sandbox if unset. */
  readonly senderId?: string;
  readonly name?: string;
  readonly timeoutMs?: number;
}

/**
 * Africa's Talking SMS (form-urlencoded + apiKey header).
 * @see https://developers.africastalking.com/docs/sms/sending/bulk
 */
export class AfricasTalkingSmsProvider implements SmsProvider {
  public readonly name: string;
  private readonly messagingUrl: string;

  public constructor(private readonly options: AfricasTalkingSmsProviderOptions) {
    this.name = options.name ?? 'africastalking';
    const base = (
      options.baseUrl ?? 'https://api.africastalking.com'
    ).replace(/\/$/, '');
    this.messagingUrl = `${base}/version1/messaging`;
  }

  public async send(message: SmsMessage): Promise<SmsSendResult> {
    const params = new URLSearchParams();
    params.set('username', this.options.username);
    params.set('to', message.to);
    params.set('message', message.body);
    const from = message.from ?? this.options.senderId;
    if (from && from.toLowerCase() !== 'sandbox') {
      params.set('from', from);
    }

    const response = await this.options.client.request({
      url: this.messagingUrl,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        apiKey: this.options.apiKey,
      },
      body: params.toString(),
      ...(this.options.timeoutMs === undefined
        ? {}
        : { timeoutMs: this.options.timeoutMs }),
    });

    return {
      provider: this.name,
      messageId: extractMessageId(response.body),
      accepted: true,
    };
  }
}

function extractMessageId(body: string | undefined): string {
  if (!body) return '';
  try {
    const parsed = JSON.parse(body) as {
      SMSMessageData?: {
        Recipients?: Array<{ messageId?: string }>;
      };
    };
    const id = parsed.SMSMessageData?.Recipients?.[0]?.messageId;
    return typeof id === 'string' ? id : body;
  } catch {
    return body;
  }
}
