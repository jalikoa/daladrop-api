import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';

/**
 * Secure Encryption Service
 * 
 * Provides AES-256-CBC encryption and decryption for sensitive payloads.
 * Uses Node's native crypto module for optimal performance and security,
 * eliminating the need for third-party libraries like crypto-js.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;
  private readonly algorithm = 'aes-256-cbc';

  constructor(private readonly configService: ConfigService) {
    /**
     * Retrieve the encryption key from environment variables.
     * Checks multiple naming conventions for maximum compatibility.
     */
    const rawKey = 
      this.configService.get<string>('ENCRYPTION_SECRET_KEY') ||
      this.configService.get<string>('encryption.secretKey') ||
      process.env.ENCRYPTION_SECRET_KEY;

    if (!rawKey) {
      this.logger.error('Encryption secret key not found in configuration');
      throw new BadRequestException('Encryption key not configured');
    }

    const trimmedKey = rawKey.trim();

    /**
     * AES-256 strictly requires a 32-byte (256-bit) key.
     * If the provided key is exactly 32 characters, we use it directly.
     * Otherwise, we cryptographically derive a secure 32-byte key using scrypt.
     * This prevents application crashes while maintaining strong security.
     */
    if (trimmedKey.length === 32) {
      this.key = Buffer.from(trimmedKey, 'utf8');
    } else {
      this.logger.warn('Provided key is not 32 bytes. Deriving a secure 32-byte key using scrypt.');
      this.key = scryptSync(trimmedKey, 'hms-encryption-salt-v1', 32);
    }

    this.logger.log('Encryption service initialized successfully');
  }

  /**
   * Encrypts a string payload and returns it as a hex-encoded string.
   * 
   * A random 16-byte Initialization Vector (IV) is generated for each 
   * encryption to ensure semantic security (identical plaintexts yield 
   * different ciphertexts). The IV is prepended to the ciphertext.
   */
  encryptPayload(data: string): string {
    try {
      const iv = randomBytes(16);
      const cipher = createCipheriv(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      /**
       * Prepend the IV to the ciphertext. The IV is not secret, but must 
       * be unique per encryption. Storing it alongside the ciphertext is standard.
       */
      return iv.toString('hex') + encrypted;
    } catch (error: any) {
      this.logger.error('Encryption failed', { error: error.message });
      throw new BadRequestException('Failed to encrypt payload');
    }
  }

  /**
   * Decrypts a hex-encoded string payload back to its original string form.
   * 
   * Extracts the 16-byte IV from the beginning of the payload before 
   * attempting decryption.
   */
  decryptPayload(encryptedHex: string): string {
    if (!encryptedHex || typeof encryptedHex !== 'string') {
      this.logger.warn('decryptPayload called with invalid token');
      throw new BadRequestException('Invalid encrypted token');
    }

    try {
      /**
       * Extract the 16-byte (32 hex characters) IV from the beginning.
       */
      const ivHex = encryptedHex.slice(0, 32);
      const ciphertextHex = encryptedHex.slice(32);

      if (ivHex.length !== 32) {
        throw new Error('Invalid encrypted payload: missing or truncated IV');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const decipher = createDecipheriv(this.algorithm, this.key, iv);

      let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: any) {
      this.logger.error('Decryption failed', {
        error: error.message,
        tokenPreview: encryptedHex.slice(0, 30),
      });
      throw new BadRequestException('Invalid or corrupted encrypted token');
    }
  }

  /**
   * Decrypts a hex-encoded payload and parses it as a JSON object.
   * Useful for structured data like payment sessions, user claims, or configs.
   */
  parsePayload(encryptedHex: string): Record<string, unknown> {
    try {
      const decryptedString = this.decryptPayload(encryptedHex);
      return JSON.parse(decryptedString);
    } catch (error: any) {
      this.logger.error('Parsing decrypted payload failed', {
        error: error.message,
      });
      throw new BadRequestException('Invalid payload format after decryption');
    }
  }
}