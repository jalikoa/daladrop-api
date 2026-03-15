import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * E2E Test Suite
 *
 * Starts a real NestJS application with all modules loaded.
 * Requires MariaDB + Redis to be running (provided by GitHub Actions
 * service containers, or locally via `docker compose up mysql redis`).
 *
 * Run locally:
 *   docker compose up mysql redis -d
 *   npm run test:e2e
 */
describe('NFC Payment API (e2e)', () => {
  let app: INestApplication<App>;
  let adminJwt: string;
  let customerJwt: string;
  let merchantId: number;

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

  // ─── Health endpoints ────────────────────────────────────────────────────
  describe('Health', () => {
    it('GET /health → 200 with status field', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('GET /health/ready → 200 ready or not_ready', async () => {
      const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
      expect(res.body.status).toMatch(/^(ready|not_ready)$/);
    });

    it('GET /health/version → 200 with version and environment', async () => {
      const res = await request(app.getHttpServer()).get('/health/version').expect(200);
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('environment');
    });

    it('GET / → 200 greeting', () => {
      return request(app.getHttpServer()).get('/').expect(200);
    });
  });

  // ─── Auth ────────────────────────────────────────────────────────────────
  describe('Auth', () => {
    it('POST /auth/login with missing body → 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);
    });

    it('POST /auth/login with wrong credentials → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrongpass' })
        .expect(401);
      expect(res.body.message).toBeDefined();
    });

    it('POST /auth/login with admin credentials → 200 + tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@nfcapi.com', password: 'AdminPass123!' })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
      expect(res.body.token_type).toBe('Bearer');
      expect(res.body.user.role).toBe('ADMIN');

      adminJwt = res.body.access_token;
    });

    it('POST /auth/refresh with valid refresh token → 200 + new tokens', async () => {
      // First get a refresh token
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@nfcapi.com', password: 'AdminPass123!' });

      const refreshToken = loginRes.body.refresh_token;

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
    });

    it('POST /auth/refresh with garbage token → 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'not.a.real.jwt' })
        .expect(401);
    });
  });

  // ─── Users ───────────────────────────────────────────────────────────────
  describe('Users (admin)', () => {
    it('GET /users without auth → 401', async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
    });

    it('GET /users with admin JWT → 200 paginated list', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminJwt}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /users creates a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({
          email: `e2e-test-${Date.now()}@example.com`,
          password: 'TestPass123!',
          role: 'CUSTOMER',
        })
        .expect(201);

      expect(res.body.email).toContain('@example.com');
      expect(res.body).not.toHaveProperty('password_hash');
    });

    it('GET /users/:id with valid admin JWT → 200', async () => {
      // Use the seeded user id=1
      await request(app.getHttpServer())
        .get('/users/1')
        .set('Authorization', `Bearer ${adminJwt}`)
        .expect(200);
    });

    it('GET /users/:id for non-existent user → 404', async () => {
      await request(app.getHttpServer())
        .get('/users/99999')
        .set('Authorization', `Bearer ${adminJwt}`)
        .expect(404);
    });
  });

  // ─── Merchants ────────────────────────────────────────────────────────────
  describe('Merchants (admin)', () => {
    it('GET /merchants without auth → 401', async () => {
      await request(app.getHttpServer()).get('/merchants').expect(401);
    });

    it('GET /merchants with admin JWT → 200 list', async () => {
      const res = await request(app.getHttpServer())
        .get('/merchants')
        .set('Authorization', `Bearer ${adminJwt}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
    });

    it('POST /merchants with missing fields → 400', async () => {
      await request(app.getHttpServer())
        .post('/merchants?user_id=2')
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({ business_name: 'x' })  // paybill_number missing
        .expect(400);
    });
  });

  // ─── Payments ─────────────────────────────────────────────────────────────
  describe('Payments', () => {
    it('POST /payments/stk with missing body → 400', async () => {
      await request(app.getHttpServer())
        .post('/payments/stk')
        .send({})
        .expect(400);
    });

    it('POST /payments/stk with invalid phone → 400', async () => {
      await request(app.getHttpServer())
        .post('/payments/stk')
        .send({ amount: 100, phone: 'not-a-phone', merchant_id: 1 })
        .expect(400);
    });

    it('POST /payments/stk with amount below minimum → 400', async () => {
      await request(app.getHttpServer())
        .post('/payments/stk')
        .send({ amount: 0, phone: '0712345678', merchant_id: 1 })
        .expect(400);
    });

    it('GET /payments/session/:uuid with bad UUID → 404', async () => {
      await request(app.getHttpServer())
        .get('/payments/session/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  // ─── NFC public endpoint ───────────────────────────────────────────────────
  describe('Public NFC endpoint', () => {
    it('GET /pay with missing token → 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/pay')
        .expect(400);
      expect(res.body.success).toBe(false);
    });

    it('GET /pay with garbage token → 400 with error message', async () => {
      const res = await request(app.getHttpServer())
        .get('/pay?token=notarealtoken')
        .expect(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });

  // ─── Webhooks ──────────────────────────────────────────────────────────────
  describe('Webhooks', () => {
    it('POST /webhooks/daraja/stk with invalid payload → 400', async () => {
      await request(app.getHttpServer())
        .post('/webhooks/daraja/stk')
        .send({ invalid: 'payload' })
        .expect(400);
    });

    it('GET /webhooks/logs → 200 paginated list', async () => {
      const res = await request(app.getHttpServer())
        .get('/webhooks/logs')
        .expect(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
    });

    it('GET /webhooks/logs/:id for non-existent log → 404', async () => {
      await request(app.getHttpServer())
        .get('/webhooks/logs/99999')
        .expect(404);
    });
  });

  // ─── Audit (admin only) ───────────────────────────────────────────────────
  describe('Audit', () => {
    it('GET /audit/logs without auth → 401', async () => {
      await request(app.getHttpServer()).get('/audit/logs').expect(401);
    });

    it('GET /audit/logs with admin JWT → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit/logs')
        .set('Authorization', `Bearer ${adminJwt}`)
        .expect(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
    });
  });

  // ─── Metrics endpoint ──────────────────────────────────────────────────────
  describe('Metrics', () => {
    it('GET /metrics → 200 Prometheus text format', async () => {
      const res = await request(app.getHttpServer())
        .get('/metrics')
        .expect(200);

      // Prometheus text format always starts with #
      expect(res.text).toContain('# HELP');
      expect(res.text).toContain('http_requests_total');
      expect(res.text).toContain('nodejs_heap_size_used_bytes');
    });
  });
});