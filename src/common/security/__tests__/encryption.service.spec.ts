import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../encryption.service';

/**
 * Unit Tests for EncryptionService
 * 
 * Verifies secure AES-256-CBC encryption, decryption, and payload parsing,
 * including edge cases like key derivation and invalid inputs.
 */
describe('EncryptionService', () => {
  let service: EncryptionService;

  /**
   * Helper to mock the ConfigService with a specific key.
   */
  const mockConfigService = (key: string | undefined) => ({
    get: jest.fn((name: string) => {
      if (name === 'ENCRYPTION_SECRET_KEY' || name === 'encryption.secretKey') {
        return key;
      }
      return undefined;
    }),
  });

  describe('Initialization', () => {
    it('should initialize successfully with a valid 32-character key', async () => {
      const validKey = 'abcdefghijklmnopqrstuvwxyz123456'; // Exactly 32 chars
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: ConfigService, useValue: mockConfigService(validKey) },
        ],
      }).compile();

      service = module.get<EncryptionService>(EncryptionService);
      expect(service).toBeDefined();
    });

    it('should initialize and derive key via scrypt if key is not 32 characters', async () => {
      const shortKey = 'shortkey'; // Less than 32 chars
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: ConfigService, useValue: mockConfigService(shortKey) },
        ],
      }).compile();

      service = module.get<EncryptionService>(EncryptionService);
      expect(service).toBeDefined();
    });

    it('should throw BadRequestException if no key is provided', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: ConfigService, useValue: mockConfigService(undefined) },
        ],
      }).compile();

      expect(() => module.get<EncryptionService>(EncryptionService)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('with valid key', () => {
    const VALID_KEY = 'abcdefghijklmnopqrstuvwxyz123456';

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: ConfigService, useValue: mockConfigService(VALID_KEY) },
        ],
      }).compile();
      service = module.get<EncryptionService>(EncryptionService);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    /**
     * Tests for the encryptPayload method.
     */
    describe('encryptPayload()', () => {
      it('should return a non-empty hex string', () => {
        const result = service.encryptPayload('{"mid":1}');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        /**
         * Verify it is a valid hex string (IV + ciphertext)
         */
        expect(/^[0-9a-fA-F]+$/.test(result)).toBe(true);
      });

      it('should produce different ciphertext each call due to random IV', () => {
        const a = service.encryptPayload('{"mid":1}');
        const b = service.encryptPayload('{"mid":1}');
        expect(a).not.toBe(b);
      });

      it('should not contain the original plaintext in the result', () => {
        const plaintext = '{"mid":1,"secret":"yes"}';
        const encrypted = service.encryptPayload(plaintext);
        expect(encrypted).not.toContain('secret');
        expect(encrypted).not.toContain('mid');
      });
    });

    /**
     * Tests for the decryptPayload method.
     */
    describe('decryptPayload()', () => {
      it('should round-trip correctly: encrypt → decrypt returns original', () => {
        const original = JSON.stringify({ mid: 1, uid: 2, issuedAt: new Date().toISOString() });
        const encrypted = service.encryptPayload(original);
        const decrypted = service.decryptPayload(encrypted);
        expect(decrypted).toBe(original);
      });

      it('should throw BadRequestException for empty token', () => {
        expect(() => service.decryptPayload('')).toThrow(BadRequestException);
      });

      it('should throw BadRequestException for non-string input', () => {
        expect(() => service.decryptPayload(null as any)).toThrow(BadRequestException);
      });

      it('should throw BadRequestException for random garbage input', () => {
        expect(() => service.decryptPayload('not-valid-aes-ciphertext!!')).toThrow(BadRequestException);
      });

      it('should throw BadRequestException for truncated hex string (missing IV)', () => {
        expect(() => service.decryptPayload('abc')).toThrow(BadRequestException);
      });

      it('should ensure error messages do not leak the secret key', () => {
        try {
          service.decryptPayload('garbage');
        } catch (e: any) {
          expect(e.message).not.toContain(VALID_KEY);
          expect(e.message).toBe('Invalid or corrupted encrypted token');
        }
      });
    });

    /**
     * Tests for the parsePayload method.
     */
    describe('parsePayload()', () => {
      it('should decrypt and parse a valid encrypted JSON string', () => {
        const originalObj = { mid: 1, uid: 2 };
        const encrypted = service.encryptPayload(JSON.stringify(originalObj));
        
        const result = service.parsePayload(encrypted);
        expect(result).toEqual(originalObj);
      });

      it('should throw BadRequestException for malformed JSON after decryption', () => {
        /**
         * Encrypt a string that is NOT valid JSON to test the parsing failure path.
         */
        const encryptedInvalidJson = service.encryptPayload('{invalid json');
        
        expect(() => service.parsePayload(encryptedInvalidJson)).toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException if decryption fails before parsing', () => {
        expect(() => service.parsePayload('not-a-valid-hex-string')).toThrow(
          BadRequestException,
        );
      });
    });
  });
});