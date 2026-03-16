import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { AppModule } from './app.module';
import { HttpMetricsInterceptor } from './common/interceptors/Http-metrics.interceptor';
import { AppLogger } from './modules/logger/logger.service';
import { MetricsService } from './modules/metrics/metrics.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { v4 as uuidv4 } from 'uuid';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Hand off NestJS internal logs to our Winston logger
    logger: false,
    bufferLogs: true,
  });

  // ── Structured logger ──────────────────────────────────────────────────────
  const logger = app.get(AppLogger);
  logger.setContext('Bootstrap');
  app.useLogger(logger);

  // ── Request ID middleware ──────────────────────────────────────────────────
  // Attaches x-request-id to every request so logs, metrics, and traces
  // can be correlated across services.
  app.use((req: any, _res: any, next: () => void) => {
    if (!req.headers['x-request-id']) {
      req.headers['x-request-id'] = uuidv4();
    }
    next();
  });

  app.useGlobalFilters(new HttpExceptionFilter(logger));

  // ── Global validation ──────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // ── Global HTTP metrics + request logging interceptor ─────────────────────
  const metricsService = app.get(MetricsService);
  app.useGlobalInterceptors(new HttpMetricsInterceptor(metricsService, logger));

  // ── CORS (adjust origins for production) ──────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`NFC API running on port ${port}`, {
    port,
    nodeEnv: process.env.NODE_ENV,
    metricsUrl: `http://localhost:${port}/metrics`,
  });
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});