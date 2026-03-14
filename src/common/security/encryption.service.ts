import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class EncryptionService {
	private readonly logger = new Logger(EncryptionService.name);
	private readonly secretKey: string;

	constructor(private readonly configService: ConfigService) {
		this.secretKey = this.configService.get<string>('NFC_SECRET_KEY');
    
		if (!this.secretKey || this.secretKey.length !== 32) {
			this.logger.error('NFC_SECRET_KEY must be exactly 32 characters for AES-256');
			throw new Error('Invalid NFC encryption key configuration');
		}
	}

	encryptPayload(data: string): string {
		return CryptoJS.AES.encrypt(data, this.secretKey).toString();
	}

	decryptPayload(token: string): string {
		try {
			const bytes = CryptoJS.AES.decrypt(token, this.secretKey);
			const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
			if (!decrypted) {
				throw new Error('Decryption produced empty result');
			}
      
			return decrypted;
		} catch (error) {
			this.logger.error('Decryption failed', error);
			throw new Error('Failed to decrypt payment token');
		}
	}

	parsePayload(decrypted: string): Record<string, unknown> {
		try {
			return JSON.parse(decrypted);
		} catch {
			throw new Error('Invalid payload format after decryption');
		}
	}
}
