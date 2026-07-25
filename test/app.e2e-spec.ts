import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

interface PublicHealthBody {
  status: string;
  timestamp?: string;
}

interface PublicInfoBody {
  name: string;
  version: string;
  environment: string;
}

interface RootMetadataBody {
  name: string;
  status: string;
  environment: string;
}

/**
 * End-to-end suite.
 *
 * Boots a real NestJS application. Requires PostgreSQL + Redis
 * (GitHub Actions service containers, or `docker compose up postgres redis`).
 *
 * Run:
 *   npm run test:e2e
 */
describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Root & public metadata', () => {
    it('GET / should return API metadata', async () => {
      const res = await request(app.getHttpServer()).get('/').expect(200);

      const body = res.body as RootMetadataBody;
      expect(typeof body.name).toBe('string');
      expect(body.status).toBe('operational');
      expect(typeof body.environment).toBe('string');
    });

    it('GET /public/health should return healthy', async () => {
      const res = await request(app.getHttpServer())
        .get('/public/health')
        .expect(200);

      const body = res.body as PublicHealthBody;
      expect(body.status).toBe('healthy');
      expect(body.timestamp).toBeDefined();
    });

    it('GET /public/info should return non-sensitive metadata', async () => {
      const res = await request(app.getHttpServer())
        .get('/public/info')
        .expect(200);

      const body = res.body as PublicInfoBody;
      expect(typeof body.name).toBe('string');
      expect(typeof body.version).toBe('string');
      expect(typeof body.environment).toBe('string');
    });
  });

  describe('Request correlation', () => {
    it('should echo x-request-id on responses', async () => {
      const res = await request(app.getHttpServer())
        .get('/public/health')
        .set('x-request-id', 'e2e-correlation-id')
        .expect(200);

      expect(res.headers['x-request-id']).toBe('e2e-correlation-id');
    });
  });
});
