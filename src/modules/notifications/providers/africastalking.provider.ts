import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider, SmsResponse } from '../interfaces/sms-provider.interface';
import axios from 'axios';

@Injectable()
export class AfricaTalkingProvider implements SmsProvider {
  private readonly logger = new Logger(AfricaTalkingProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async send(to: string, message: string): Promise<SmsResponse> {
    // Truncate message to 324 characters (Africa's Talking limit for single SMS)
    const truncatedMessage = message.slice(0, 324);
    
    this.logger.log(`Sending SMS via Africa's Talking`);
    this.logger.log(`   To: ${to}`);
    this.logger.log(`   Message (${truncatedMessage.length} chars): ${truncatedMessage}`);

    try {
      const apiKey = this.configService.get<string>('AFRICAS_TALKING_API_KEY');
      const username = this.configService.get<string>('AFRICAS_TALKING_USERNAME');

      if (!apiKey || !username) {
        this.logger.warn('Africa\'s Talking credentials not configured. SMS not sent.');
        return {
          success: false,
          error: 'Africa\'s Talking credentials not configured',
        };
      }

      const response = await axios.post(
        'https://api.africastalking.com/version1/messaging',
        {
          username,
          to,
          message: truncatedMessage,
        },
        {
          headers: {
            apiKey,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );

      const recipientData = response.data.SMSMessageData.Recipient[0];
      const success = recipientData.statusCode === '101';

      this.logger.log(`   SMS sent ${success ? 'successfully' : 'with issues'}`);
      this.logger.log(`   Status Code: ${recipientData.statusCode}`);
      this.logger.log(`   Message ID: ${recipientData.messageId}`);

      return {
        success,
        messageId: recipientData.messageId,
      };
    } catch (error) {
      this.logger.error(`   SMS sending failed: ${(error as Error).message}`);
      if ((error as any).response?.data) {
        this.logger.error(`   API Response: ${JSON.stringify((error as any).response.data)}`);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
