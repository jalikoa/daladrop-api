import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../encryption.service';

// Key must be exactly 32 chars for AES-256
const VALID_KEY = 'abcdefghijklmnopqrstuvwxyz123456';

const mockConfigService = (key: string | undefined) => ({
  get: jest.fn((name: string) => {
    if (name === 'NFC_SECRET_KEY' || name === 'nfc.secretKey') return key;
    return undefined;
  }),
});

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        { provide: ConfigService, useValue: mockConfigService(VALID_KEY) },
      ],
    }).compile();
    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('encryptPayload()', () => {
    it('returns a non-empty string', () => {
      const result = service.encryptPayload('{"mid":1}');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('produces different ciphertext each call (IV randomness)', () => {
      const a = service.encryptPayload('{"mid":1}');
      const b = service.encryptPayload('{"mid":1}');
      expect(a).not.toBe(b);
    });

    it('result is not the original plaintext', () => {
      const plaintext = '{"mid":1,"secret":"yes"}';
      const encrypted = service.encryptPayload(plaintext);
      expect(encrypted).not.toContain('secret');
    });
  });

  describe('decryptPayload()', () => {
    it('round-trips correctly: encrypt → decrypt returns original', () => {
      const original = JSON.stringify({ mid: 1, uid: 2, issuedAt: new Date().toISOString() });
      const encrypted = service.encryptPayload(original);
      const decrypted = service.decryptPayload(encrypted);
      expect(decrypted).toBe(original);
    });

    it('throws BadRequestException for empty token', () => {
      expect(() => service.decryptPayload('')).toThrow(BadRequestException);
    });

    it('throws BadRequestException for non-string input', () => {
      expect(() => service.decryptPayload(null as any)).toThrow(BadRequestException);
    });

    it('throws BadRequestException for random garbage input', () => {
      expect(() => service.decryptPayload('not-valid-aes-ciphertext!!')).toThrow(BadRequestException);
    });

    it('error message does not leak the secret key', () => {
      try {
        service.decryptPayload('garbage');
      } catch (e: any) {
        expect(e.message).not.toContain(VALID_KEY);
      }
    });
  });

  describe('parsePayload()', () => {
    it('parses valid JSON string', () => {
      const result = service.parsePayload('{"mid":1,"uid":2}');
      expect(result).toEqual({ mid: 1, uid: 2 });
    });

    it('throws BadRequestException for malformed JSON', () => {
      expect(() => service.parsePayload('{invalid json')).toThrow(BadRequestException);
    });
  });
});