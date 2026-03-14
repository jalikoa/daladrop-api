import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider, SmsResponse } from '../interfaces/sms-provider.interface';
import axios from 'axios';

@Injectable()
export class AfricaTalkingProvider implements SmsProvider {
  constructor(private readonly configService: ConfigService) {}

  async send(to: string, message: string): Promise<SmsResponse> {
    try {
      const apiKey = this.configService.get<string>('AFRICAS_TALKING_API_KEY');
      const username = this.configService.get<string>('AFRICAS_TALKING_USERNAME');

      const response = await axios.post(
        'https://api.africastalking.com/version1/messaging',
        {
          username,
          to,
          message,
        },
        {
          headers: {
            apiKey,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );

      return {
        success: response.data.SMSMessageData.Recipient[0].statusCode === '101',
        messageId: response.data.SMSMessageData.Recipient[0].messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
