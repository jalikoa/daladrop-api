import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';

/**
 * Smoke Tests - Critical Flow Verification
 * 
 * Quick tests to ensure critical application flows work after deployment.
 * These should run in under 30 seconds and catch major regressions.
 * 
 * Run with: npm run test:smoke
 */

describe('Smoke Tests - Critical Flows', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Checks', () => {
    it('/health should return 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(res.body.status).toBeDefined();
    });

    it('/health/ready should return 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);

      expect(res.body.status).toBeDefined();
    });

    it('/health/version should return 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/health/version')
        .expect(200);

      expect(res.body.version).toBeDefined();
    });

    it('/metrics should return 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/metrics')
        .expect(200);

      expect(res.text).toContain('# HELP');
    });
  });

  describe('Authentication Flow', () => {
    it('POST /auth/login with admin credentials should return 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@nfcapi.com', password: 'AdminPass123!' })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
      expect(res.body.token_type).toBe('Bearer');
    });

    it('POST /auth/login with invalid credentials should return 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'invalid@example.com', password: 'wrongpassword' })
        .expect(401);
    });

    it('POST /auth/refresh with invalid token should return 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'invalid-token' })
        .expect(401);
    });
  });

  describe('Public NFC Endpoint', () => {
    it('GET /pay without token should return 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/pay')
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('GET /pay with invalid token should return 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/pay?token=invalid')
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('Payment Validation', () => {
    it('POST /payments/stk with invalid data should return 400', async () => {
      await request(app.getHttpServer())
        .post('/payments/stk')
        .send({})
        .expect(400);
    });

    it('POST /payments/stk with invalid phone should return 400', async () => {
      await request(app.getHttpServer())
        .post('/payments/stk')
        .send({ amount: 500, phone: 'invalid', merchant_id: 1, merchant_hash: 'test' })
        .expect(400);
    });

    it('POST /payments/stk with invalid amount should return 400', async () => {
      await request(app.getHttpServer())
        .post('/payments/stk')
        .send({ amount: 0, phone: '0712345678', merchant_id: 1, merchant_hash: 'test' })
        .expect(400);
    });
  });

  describe('Webhook Endpoint', () => {
    it('POST /webhooks/daraja/stk with invalid payload should return 400', async () => {
      await request(app.getHttpServer())
        .post('/webhooks/daraja/stk')
        .send({})
        .expect(400);
    });
  });

  describe('Protected Endpoints Require Auth', () => {
    it('GET /users without auth should return 401', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .expect(401);
    });

    it('GET /merchants without auth should return 401', async () => {
      await request(app.getHttpServer())
        .get('/merchants')
        .expect(401);
    });

    it('GET /ledger/accounts/1/balance without auth should return 401', async () => {
      await request(app.getHttpServer())
        .get('/ledger/accounts/1/balance')
        .expect(401);
    });

    it('GET /queues without auth should return 401', async () => {
      await request(app.getHttpServer())
        .get('/queues')
        .expect(401);
    });

    it('GET /audit/logs without auth should return 401', async () => {
      await request(app.getHttpServer())
        .get('/audit/logs')
        .expect(401);
    });
  });

  describe('Database Connection', () => {
    it('should connect to database successfully', async () => {
      // If we can hit the health endpoint, DB is connected
      const res = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);

      expect(res.body.status).toBeDefined();
    });
  });
});
