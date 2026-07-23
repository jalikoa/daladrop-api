import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLogger } from '../modules/logger/logger.service';
import { BaseExceptionFilter } from '@nestjs/core';

/**
 * Global HTTP Exception Filter
 * 
 * Catches all unhandled exceptions, logs them with appropriate severity 
 * based on the status code, and returns a standardized JSON error response.
 * Extends BaseExceptionFilter to ensure NestJS default fallback behavior 
 * is preserved for truly unknown edge cases.
 */
@Catch()
export class HttpExceptionFilter extends BaseExceptionFilter implements ExceptionFilter {
  constructor(private readonly appLogger: AppLogger) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    /**
     * Determine the HTTP status code.
     * Defaults to 500 Internal Server Error for unknown exceptions.
     */
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    /**
     * Extract the error message safely.
     * Handles both string responses and object responses (e.g., { message: '...', error: '...' })
     * returned by NestJS HttpException, falling back to standard Error messages.
     */
    let message = 'Internal server error';
    if (exception instanceof HttpException) {
      const responsePayload = exception.getResponse();
      message = typeof responsePayload === 'object' && responsePayload !== null
        ? (responsePayload as any).message || JSON.stringify(responsePayload)
        : responsePayload;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const stack = exception instanceof Error ? exception.stack : undefined;
    const requestId = request.headers['x-request-id'] as string || 'unknown';

    /**
     * Construct structured log data for observability platforms.
     */
    const logData = {
      type: 'http_error',
      statusCode: status,
      route: request.url,
      method: request.method,
      requestId,
    };

    /**
     * Define which status codes are considered expected client errors.
     * These are logged as 'warn' to avoid polluting error monitoring 
     * tools (like Sentry) with expected 4xx responses.
     */
    const clientErrorCodes = [
      HttpStatus.BAD_REQUEST,
      HttpStatus.UNAUTHORIZED,
      HttpStatus.FORBIDDEN,
      HttpStatus.NOT_FOUND,
      HttpStatus.CONFLICT,
      HttpStatus.UNPROCESSABLE_ENTITY,
      HttpStatus.TOO_MANY_REQUESTS,
    ];

    /**
     * Log with appropriate severity based on the status code.
     * 5xx errors include the stack trace for debugging.
     */
    if (clientErrorCodes.includes(status)) {
      this.appLogger.warn(`${request.method} ${request.url} → ${status}: ${message}`, {
        context: 'HTTP',
        ...logData,
      });
    } else if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.appLogger.error(`${request.method} ${request.url} → ${status}: ${message}`, stack, {
        context: 'HTTP',
        ...logData,
      });
    } else {
      this.appLogger.warn(`${request.method} ${request.url} → ${status}: ${message}`, {
        context: 'HTTP',
        ...logData,
      });
    }

    /**
     * Send the standardized JSON error response to the client.
     * The headersSent check prevents "Cannot set headers after they are sent" 
     * errors if another middleware or interceptor has already responded.
     */
    if (!response.headersSent) {
      response.status(status).json({
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId,
      });
    }
  }
}