import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

/**
 * Structured logger that wraps Winston.
 *
 * Transports:
 *   - Console   → always on (pretty in dev, JSON in prod)
 *   - File      → always on (JSON lines, rotated daily via logrotate or Docker log driver)
 *   - Elasticsearch → on when ELASTICSEARCH_URL is set
 *
 * Every log line carries:
 *   timestamp, level, context (NestJS class name), message,
 *   trace (error stack), and any extra fields passed as metadata.
 *
 * Drop-in replacement for NestJS's built-in Logger:
 *   constructor(private readonly logger: AppLogger) {}
 *   this.logger.log('thing happened', { extra: 'data' });
 */
@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger: winston.Logger;
  private context = 'App';

  constructor(private readonly configService: ConfigService) {
    const isDev = (configService.get('NODE_ENV') || 'development') === 'development';
    const esUrl = configService.get<string>('ELASTICSEARCH_URL');
    const appName = configService.get<string>('APP_NAME') || 'nfc-api';
    const nodeEnv = configService.get<string>('NODE_ENV') || 'development';

    // ── Formats ──────────────────────────────────────────────────────────────
    const baseFields = winston.format((info) => {
      info.service = appName;
      info.environment = nodeEnv;
      return info;
    });

    const timestampFormat = winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' });

    const consoleFormat = isDev
      ? winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, context, message, trace, ...meta }) => {
            const ctx = context ? `[${context}] ` : '';
            const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            const stack = trace ? `\n${trace}` : '';
            return `${timestamp} ${level} ${ctx}${message}${extra}${stack}`;
          }),
        )
      : winston.format.json();

    const fileFormat = winston.format.combine(
      baseFields(),
      timestampFormat,
      winston.format.errors({ stack: true }),
      winston.format.json(),
    );

    // ── Transports ───────────────────────────────────────────────────────────
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(timestampFormat, consoleFormat),
        handleExceptions: true,
      }),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: fileFormat,
        maxsize: 10 * 1024 * 1024, // 10 MB
        maxFiles: 14,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: fileFormat,
        maxsize: 20 * 1024 * 1024, // 20 MB
        maxFiles: 7,
      }),
    ];

    if (esUrl) {
      const esTransport = new ElasticsearchTransport({
        level: 'info',
        clientOpts: {
          node: esUrl,
          auth: {
            username: configService.get('ELASTICSEARCH_USERNAME') || 'elastic',
            password: configService.get('ELASTICSEARCH_PASSWORD') || 'changeme',
          },
        },
        indexPrefix: `${appName}-logs`,
        indexSuffixPattern: 'YYYY.MM.DD',
        transformer: (logData) => ({
          '@timestamp': logData.timestamp || new Date().toISOString(),
          severity: logData.level,
          message: logData.message,
          context: logData.meta?.context || 'App',
          service: appName,
          environment: nodeEnv,
          trace: logData.meta?.trace,
          ...logData.meta,
        }),
      });

      esTransport.on('error', (err) => {
        // Prevent ES transport errors from crashing the app
        process.stderr.write(`[AppLogger] Elasticsearch transport error: ${err.message}\n`);
      });

      transports.push(esTransport);
    }

    this.logger = winston.createLogger({
      level: isDev ? 'debug' : 'info',
      transports,
      exitOnError: false,
    });
  }

  setContext(context: string): this {
    this.context = context;
    return this;
  }

  // ── NestJS LoggerService interface ─────────────────────────────────────────

  log(message: string, meta?: Record<string, unknown> | string): void {
    const context = typeof meta === 'string' ? meta : this.context;
    const extra = typeof meta === 'object' ? meta : {};
    this.logger.info({ message, context, ...extra });
  }

  error(message: string, trace?: string, meta?: Record<string, unknown> | string): void {
    const context = typeof meta === 'string' ? meta : this.context;
    const extra = typeof meta === 'object' ? meta : {};
    this.logger.error({ message, context, trace, ...extra });
  }

  warn(message: string, meta?: Record<string, unknown> | string): void {
    const context = typeof meta === 'string' ? meta : this.context;
    const extra = typeof meta === 'object' ? meta : {};
    this.logger.warn({ message, context, ...extra });
  }

  debug(message: string, meta?: Record<string, unknown> | string): void {
    const context = typeof meta === 'string' ? meta : this.context;
    const extra = typeof meta === 'object' ? meta : {};
    this.logger.debug({ message, context, ...extra });
  }

  verbose(message: string, meta?: Record<string, unknown> | string): void {
    const context = typeof meta === 'string' ? meta : this.context;
    const extra = typeof meta === 'object' ? meta : {};
    this.logger.verbose({ message, context, ...extra });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Log an HTTP request in a structured way — used by the HTTP interceptor */
  logRequest(data: {
    method: string;
    url: string;
    statusCode: number;
    durationMs: number;
    ip?: string;
    userAgent?: string;
    userId?: number;
    requestId?: string;
  }): void {
    this.logger.info({
      message: `${data.method} ${data.url} ${data.statusCode} ${data.durationMs}ms`,
      context: 'HTTP',
      type: 'http_request',
      ...data,
    });
  }

  /** Log a payment event */
  logPayment(data: {
    event: string;
    sessionUuid: string;
    merchantId: number;
    amount?: number;
    phone?: string;
    status?: string;
    durationMs?: number;
  }): void {
    this.logger.info({
      message: `Payment ${data.event}: session=${data.sessionUuid}`,
      context: 'Payment',
      type: 'payment_event',
      ...data,
    });
  }
}