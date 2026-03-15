import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    const key =
      this.configService.get<string>('nfc.secretKey') ||
      this.configService.get<string>('NFC_SECRET_KEY');

    if (!key || key.length !== 32) {
      this.logger.error('NFC_SECRET_KEY must be exactly 32 characters for AES-256');
      // log masked key length for debugging without exposing secret
      this.logger.debug(`NFC key length: ${key ? key.length : 'undefined'}`);
      throw new BadRequestException('Invalid NFC encryption key configuration');
    }

    this.secretKey = key;
  }

  encryptPayload(data: string): string {
    return CryptoJS.AES.encrypt(data, this.secretKey).toString();
  }

  decryptPayload(token: string): string {
    if (!token || typeof token !== 'string') {
      this.logger.warn('decryptPayload called with invalid token');
      throw new BadRequestException('Invalid payment token');
    }

    try {
      const bytes = CryptoJS.AES.decrypt(token, this.secretKey);
      // bytes may be falsy or not contain expected fields for malformed tokens
      if (!bytes) {
        this.logger.warn('AES.decrypt returned falsy value');
        throw new BadRequestException('Failed to decrypt payment token');
      }

      const decrypted = bytes.toString(CryptoJS.enc.Utf8);

      if (!decrypted) {
        this.logger.warn('Decryption produced empty result');
        throw new BadRequestException('Failed to decrypt payment token');
      }

      return decrypted;
    } catch (err: any) {
      // CryptoJS can throw deep internal errors (e.g., reading salt); log details for debugging
      this.logger.error('Decryption failed', err?.stack || err?.message || err);
      throw new BadRequestException('Invalid or corrupted payment token');
    }
  }

  parsePayload(decrypted: string): Record<string, unknown> {
    try {
      return JSON.parse(decrypted);
    } catch (err) {
      this.logger.error('Parsing decrypted payload failed', err?.message || err);
      throw new BadRequestException('Invalid payload format after decryption');
    }
  }
}