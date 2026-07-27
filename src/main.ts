import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpMetricsInterceptor } from './common/interceptors/http-metrics.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AppLogger } from './modules/logger/logger.service';
import { MetricsService } from './modules/metrics/metrics.service';

type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;

/**
 * HTTP bootstrap for the reusable NestJS API scaffold.
 *
 * Pipeline stages (mirrors FoundationModule documentation):
 * 1. request correlation id
 * 2. validation pipe
 * 3. HTTP metrics + structured request logs
 * 4. exception filter with production-safe error redaction
 *
 * Do not import FoundationModule here until AppModule drops the legacy
 * `src/modules` stack — see AppModule JSDoc.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Keep Nest's default logger until AppLogger is wired so DI / env
    // validation failures are visible on stderr (logger:false hid them).
    bufferLogs: true,
    rawBody: true,
  });

  // Socket.IO primary transport (polling fallback) via platform realtime gateway.
  app.useWebSocketAdapter(new IoAdapter(app));

  const config = app.get(ConfigService);
  const logger = app.get(AppLogger);
  logger.setContext('Bootstrap');
  app.useLogger(logger);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const requestIdMiddleware = new RequestIdMiddleware();
  app.use((req: Request, res: Response, next: NextFunction) =>
    requestIdMiddleware.use(req, res, next),
  );

  const globalPrefix = config.get<string>('app.globalPrefix', '');
  if (globalPrefix) {
    app.setGlobalPrefix(globalPrefix);
  }

  // URI versioning: controllers resolve under /v1/... by default.
  // Health/public probes stay version-neutral for load balancers.
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalFilters(new HttpExceptionFilter(logger));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
      disableErrorMessages:
        config.get<string>('app.environment') === 'production',
    }),
  );

  const metricsService = app.get(MetricsService);
  app.useGlobalInterceptors(new HttpMetricsInterceptor(metricsService, logger));

  const allowedOrigins = config.get<string[]>('app.corsOrigins', [
    'http://localhost:3000',
  ]);
  const isProduction =
    config.get<string>('app.environment') === 'production';

  app.enableCors({
    origin: (origin: string | undefined, callback: CorsOriginCallback) => {
      // No Origin header (curl/server-to-server) — allow.
      if (!origin) {
        callback(null, true);
        return;
      }
      // Browsers send the literal string "null" for file:// pages.
      // Allow only outside production so local admin.html can be opened
      // directly; prefer http://localhost:<port>/admin.html instead.
      if (origin === 'null') {
        callback(null, !isProduction);
        return;
      }
      if (allowedOrigins.includes('*')) {
        callback(null, !isProduction);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      // Deny without throwing — throwing omits ACAO and looks like a
      // generic CORS failure in the browser.
      callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Device-Id',
      'X-Session-Id',
      'X-Request-Id',
      'Idempotency-Key',
    ],
    credentials: true,
  });

  // Internal ops console — same-origin avoids file:// CORS issues.
  const adminHtmlPath = join(process.cwd(), 'admin.html');
  const http = app.getHttpAdapter().getInstance() as {
    get: (path: string, handler: (req: Request, res: Response) => void) => void;
  };
  http.get('/admin.html', (_req: Request, res: Response) => {
    if (!existsSync(adminHtmlPath)) {
      res.status(404).type('text').send('admin.html not found in process.cwd()');
      return;
    }
    res.sendFile(adminHtmlPath);
  });
  http.get('/admin', (_req: Request, res: Response) => {
    res.redirect(302, '/admin.html');
  });

  const swaggerEnabled =
    config.get<string>('app.environment') !== 'production' ||
    process.env.SWAGGER_ENABLED === 'true';
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(config.get<string>('app.name', 'API'))
      .setDescription('DalaDrop Enterprise API')
      .setVersion(process.env.npm_package_version || '1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();

  const port = config.get<number>('app.port', 3000);
  await app.listen(port);

  logger.log(`API listening on port ${port}`, {
    port,
    environment: config.get<string>('app.environment'),
    orm: config.get<string>('orm.type'),
    realtime: process.env.REALTIME_ENABLED === 'true' ? 'on' : 'off',
    docs: swaggerEnabled ? '/api/docs' : undefined,
    adminConsole: existsSync(adminHtmlPath) ? '/admin.html' : undefined,
  });
}

bootstrap().catch((err: unknown) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
