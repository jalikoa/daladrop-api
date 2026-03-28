import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProvider, EmailResponse } from '../interfaces/email-provider.interface';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NodemailerProvider implements EmailProvider {
  private readonly logger = new Logger(NodemailerProvider.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  async send(to: string, subject: string, body: string): Promise<EmailResponse> {
    this.logger.log(`Sending email via Nodemailer`);
    this.logger.log(`   To: ${to}`);
    this.logger.log(`   Subject: ${subject}`);

    try {
      const smtpHost = this.configService.get('SMTP_HOST');
      const smtpUser = this.configService.get('SMTP_USER');

      if (!smtpHost || !smtpUser) {
        this.logger.warn('SMTP credentials not configured. Email not sent.');
        return {
          success: false,
          error: 'SMTP credentials not configured',
        };
      }

      const info = await this.transporter.sendMail({
        from: this.configService.get('SMTP_FROM') || '"TapPay" <noreply@tappay.co.ke>',
        to,
        subject,
        html: body,
      });

      this.logger.log(`   Email sent successfully`);
      this.logger.log(`   Message ID: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      this.logger.error(`   Email sending failed: ${(error as Error).message}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
