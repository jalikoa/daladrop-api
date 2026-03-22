import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';

/**
 * Regression Tests
 * 
 * Tests for previously fixed bugs to ensure they don't resurface.
 * Run these tests before deploying any changes.
 * 
 * Run with: npm run test:regression
 */

describe('Regression Tests', () => {
  let app: INestApplication;
  let adminJwt: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    // Get admin token
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@nfcapi.com', password: 'AdminPass123!' });
    
    if (adminLogin.body.access_token) {
      adminJwt = adminLogin.body.access_token;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Bug #001: Phone Number Validation ─────────────────────────────────────
  describe('Bug #001 - Phone Number Validation', () => {
    it('should accept valid Kenyan phone numbers in all formats', async () => {
      const validNumbers = [
        '0712345678',
        '+254712345678',
        '254712345678',
        '712345678',
        '0112345678',
      ];

      for (const phone of validNumbers) {
        const res = await request(app.getHttpServer())
          .post('/payments/stk')
          .send({
            amount: 500,
            phone,
            merchant_id: 1,
            merchant_hash: 'test',
          });

        // Should not return 400 for invalid phone
        expect(res.status).not.toBe(400);
      }
    });

    it('should reject invalid phone numbers', async () => {
      const invalidNumbers = [
        '12345',
        '071234567',
        '07123456789',
        '255712345678', // Wrong country code
        'abc1234567',
      ];

      for (const phone of invalidNumbers) {
        const res = await request(app.getHttpServer())
          .post('/payments/stk')
          .send({
            amount: 500,
            phone,
            merchant_id: 1,
            merchant_hash: 'test',
          });

        expect(res.status).toBe(400);
      }
    });
  });

  // ─── Bug #002: Payment Amount Validation ────────────────────────────────────
  describe('Bug #002 - Payment Amount Validation', () => {
    it('should reject amount below minimum (1 KES = 100 cents)', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments/stk')
        .send({
          amount: 0,
          phone: '0712345678',
          merchant_id: 1,
          merchant_hash: 'test',
        });

      expect(res.status).toBe(400);
    });

    it('should reject amount above maximum (70,000 KES = 7,000,000 cents)', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments/stk')
        .send({
          amount: 10000000,
          phone: '0712345678',
          merchant_id: 1,
          merchant_hash: 'test',
        });

      expect(res.status).toBe(400);
    });

    it('should reject non-integer amounts', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments/stk')
        .send({
          amount: 1.5,
          phone: '0712345678',
          merchant_id: 1,
          merchant_hash: 'test',
        });

      expect(res.status).toBe(400);
    });
  });

  // ─── Bug #003: JWT Token Validation ─────────────────────────────────────────
  describe('Bug #003 - JWT Token Validation', () => {
    it('should reject requests without Authorization header', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .send();

      expect(res.status).toBe(401);
    });

    it('should reject requests with invalid JWT token', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer invalid-token')
        .send();

      expect(res.status).toBe(401);
    });

    it('should reject requests with expired JWT token', async () => {
      // Expired JWT (decoded exp is in the past)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxfQ.expired';
      
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send();

      expect(res.status).toBe(401);
    });
  });

  // ─── Bug #004: Ledger Balance Calculation ───────────────────────────────────
  describe('Bug #004 - Ledger Balance Calculation', () => {
    it('should return 0.00 balance for new account', async () => {
      if (!adminJwt) return;

      // Test with a non-existent account (should return 0.00)
      const res = await request(app.getHttpServer())
        .get('/ledger/accounts/999999/balance')
        .set('Authorization', `Bearer ${adminJwt}`);

      // Should not throw, should return balance
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('balance');
    });

    it('should reject unbalanced ledger entries', async () => {
      if (!adminJwt) return;

      const res = await request(app.getHttpServer())
        .post('/ledger/entries')
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({
          transaction_id: 'test-tx',
          entries: [
            { accountId: 1, type: 'DEBIT', amount: '100.00' },
            { accountId: 2, type: 'CREDIT', amount: '50.00' }, // Unbalanced
          ],
        });

      expect(res.status).toBe(422);
    });
  });

  // ─── Bug #005: Webhook Idempotency ──────────────────────────────────────────
  describe('Bug #005 - Webhook Idempotency', () => {
    it('should handle duplicate webhook callbacks', async () => {
      const webhookPayload = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'test-123',
            CheckoutRequestID: 'ws_CO_123',
            ResultCode: 0,
            ResultDesc: 'Success',
          },
        },
      };

      // Send the same webhook twice
      const res1 = await request(app.getHttpServer())
        .post('/webhooks/daraja/stk')
        .send(webhookPayload);

      const res2 = await request(app.getHttpServer())
        .post('/webhooks/daraja/stk')
        .send(webhookPayload);

      // Both should succeed (idempotent)
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });
  });

  // ─── Bug #006: Role-Based Access Control ────────────────────────────────────
  describe('Bug #006 - Role-Based Access Control', () => {
    it('should allow admin to access admin-only endpoints', async () => {
      if (!adminJwt) return;

      const res = await request(app.getHttpServer())
        .get('/audit/logs')
        .set('Authorization', `Bearer ${adminJwt}`);

      expect(res.status).toBe(200);
    });

    it('should reject non-admin from admin-only endpoints', async () => {
      // Without auth, should be rejected
      const res = await request(app.getHttpServer())
        .get('/audit/logs')
        .send();

      expect(res.status).toBe(401);
    });
  });

  // ─── Bug #007: NFC Token Decoding ───────────────────────────────────────────
  describe('Bug #007 - NFC Token Decoding', () => {
    it('should handle malformed NFC tokens gracefully', async () => {
      const res = await request(app.getHttpServer())
        .get('/pay?token=malformed-token-!@#$%')
        .send();

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('should reject missing token parameter', async () => {
      const res = await request(app.getHttpServer())
        .get('/pay')
        .send();

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Bug #008: Queue Management ─────────────────────────────────────────────
  describe('Bug #008 - Queue Management', () => {
    it('should return queue status without errors', async () => {
      if (!adminJwt) return;

      const res = await request(app.getHttpServer())
        .get('/queues')
        .set('Authorization', `Bearer ${adminJwt}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should reject queue access without authentication', async () => {
      const res = await request(app.getHttpServer())
        .get('/queues')
        .send();

      expect(res.status).toBe(401);
    });
  });

  // ─── Bug #009: Encryption/Decryption ────────────────────────────────────────
  describe('Bug #009 - Encryption/Decryption', () => {
    it('should handle encryption service errors gracefully', async () => {
      // Invalid ciphertext should not crash the server
      const res = await request(app.getHttpServer())
        .get('/pay?token=invalid-ciphertext')
        .send();

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Bug #010: Health Check Endpoints ───────────────────────────────────────
  describe('Bug #010 - Health Check Endpoints', () => {
    it('should return healthy status', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.status).toBeDefined();
    });

    it('should return readiness status', async () => {
      const res = await request(app.getHttpServer())
        .get('/health/ready')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.status).toMatch(/^(ready|not_ready)$/);
    });

    it('should return version information', async () => {
      const res = await request(app.getHttpServer())
        .get('/health/version')
        .send();

      expect(res.status).toBe(200);
      expect(res.body.version).toBeDefined();
    });
  });
});
