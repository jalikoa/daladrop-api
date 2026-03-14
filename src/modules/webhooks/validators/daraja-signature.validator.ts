import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class DarajaSignatureValidator {
  private readonly logger = new Logger(DarajaSignatureValidator.name);
  private readonly publicKey: string;

  constructor(private readonly configService: ConfigService) {
    this.publicKey = this.configService.get<string>('DARAJA_PUBLIC_KEY') || '';
  }

  async verify(payload: string, signature: string): Promise<boolean> {
    if (!signature) {
      this.logger.warn('No signature provided in Daraja callback');
      if (this.configService.get('NODE_ENV') !== 'production') return true;
      return false;
    }

    try {
      const verifier = crypto.createVerify('SHA256');
      verifier.update(payload);
      verifier.end();

      const isValid = verifier.verify(this.publicKey, signature, 'base64');
      this.logger.log(`Daraja signature verification: ${isValid ? 'PASSED' : 'FAILED'}`);
      return isValid;
    } catch (error) {
      this.logger.error('Signature verification failed', error);
      return false;
    }
  }

  isSafaricomIP(ip: string): boolean {
    const safaricomRanges = ['156.154.64.', '156.154.65.', '196.201.216.', '196.201.217.'];
    return safaricomRanges.some((range) => ip.startsWith(range));
  }
}
