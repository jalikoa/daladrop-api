// src/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AppLogger } from 'src/modules/logger/logger.service';
import { BaseExceptionFilter } from '@nestjs/core';

@Catch()
export class HttpExceptionFilter extends BaseExceptionFilter implements ExceptionFilter {
  constructor(private readonly appLogger: AppLogger) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? (typeof exception.getResponse() === 'object'
          ? (exception.getResponse() as any).message
          : exception.getResponse())
      : (exception instanceof Error ? exception.message : 'Internal server error');

    const stack = exception instanceof Error ? exception.stack : undefined;

    const logData = {
      type: 'http_error',
      statusCode: status,
      route: request.url,
      durationMs: (Date.now() - (request as any).startTime) || 0,
      requestId: (request as any).requestId,
    };

    const clientErrorCodes = [
      HttpStatus.BAD_REQUEST,
      HttpStatus.UNAUTHORIZED,
      HttpStatus.FORBIDDEN,
      HttpStatus.NOT_FOUND,
      HttpStatus.CONFLICT,
      HttpStatus.UNPROCESSABLE_ENTITY,
      HttpStatus.TOO_MANY_REQUESTS,
    ];

    if (clientErrorCodes.includes(status)) {
      this.appLogger.warn(`${request.method} ${request.url} → ${status}: ${message}`, {
        context: 'HTTP',
        ...logData,
      });
    } else if (status >= 500) {
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

    if (!response.headersSent) {
      response.status(status).json({
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  }
}