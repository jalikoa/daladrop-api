import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    const keyFromNested = this.configService.get<string>('nfc.secretKey');
    const keyFromUpper = this.configService.get<string>('NFC_SECRET_KEY');
    const keyFromEnv = process.env.NFC_SECRET_KEY;

    const rawKey = keyFromNested || keyFromUpper || keyFromEnv;

    if (!rawKey) {
      this.logger.error('NFC_SECRET_KEY not found in config');
      throw new BadRequestException('NFC encryption key not configured');
    }

    const key = rawKey.trim();

    if (key.length !== 32) {
      this.logger.error(`Invalid key length: ${key.length}, expected 32`);
      throw new BadRequestException(`Invalid NFC key length: ${key.length} != 32`);
    }

    this.secretKey = key;
    this.logger.log('NFC encryption key loaded');
  }

  encryptPayload(data: string): string {
    const encrypted = CryptoJS.AES.encrypt(data, this.secretKey);
    const base64 = encrypted.toString();
    return this.base64ToHex(base64);
  }

  decryptPayload(token: string): string {
    if (!token || typeof token !== 'string') {
      this.logger.warn('decryptPayload called with invalid token');
      throw new BadRequestException('Invalid payment token');
    }

    try {
      const normalizedToken = this.isHex(token) ? this.hexToBase64(token) : token;
      const bytes = CryptoJS.AES.decrypt(normalizedToken, this.secretKey);

      if (!bytes) {
        this.logger.warn('AES.decrypt returned falsy value');
        throw new BadRequestException('Failed to decrypt payment token');
      }

      const decrypted = bytes.toString(CryptoJS.enc.Utf8);

      if (!decrypted) {
        this.logger.warn('Decryption produced empty result', {
          keyLength: this.secretKey.length,
          tokenStart: token.slice(0, 30),
        });
        throw new BadRequestException('Failed to decrypt payment token');
      }

      return decrypted;
    } catch (err: any) {
      this.logger.error('Decryption failed', {
        error: err?.message,
        keyPreview: this.secretKey?.slice(0, 4),
        tokenPreview: token?.slice(0, 30),
      });
      throw new BadRequestException('Invalid or corrupted payment token');
    }
  }

  parsePayload(decrypted: string): Record<string, unknown> {
    try {
      return JSON.parse(decrypted);
    } catch (err) {
      this.logger.error('Parsing decrypted payload failed', {
        err: err?.message,
        payloadPreview: decrypted?.slice(0, 100),
      });
      throw new BadRequestException('Invalid payload format after decryption');
    }
  }

  private isHex(str: string): boolean {
    return /^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0;
  }

  private base64ToHex(base64: string): string {
    const wordArray = CryptoJS.enc.Base64.parse(base64);
    return wordArray.toString(CryptoJS.enc.Hex);
  }

  private hexToBase64(hex: string): string {
    const wordArray = CryptoJS.enc.Hex.parse(hex);
    return wordArray.toString(CryptoJS.enc.Base64);
  }
}