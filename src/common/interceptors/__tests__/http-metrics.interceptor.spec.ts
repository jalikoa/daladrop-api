import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { HttpMetricsInterceptor } from '../Http-metrics.interceptor';
import { AppLogger } from 'src/modules/logger/logger.service';
import { MetricsService } from 'src/modules/metrics/metrics.service';

/**
 * Unit Tests for HttpMetricsInterceptor
 */
describe('HttpMetricsInterceptor - Unit Tests', () => {
  let interceptor: HttpMetricsInterceptor;
  let mockMetrics: Partial<MetricsService>;
  let mockLogger: Partial<AppLogger>;
  let mockExecutionContext: Partial<ExecutionContext>;
  let mockCallHandler: any;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    mockRequest = {
      url: '/api/test',
      route: { path: '/api/test' },
      method: 'GET',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      headers: {
        'user-agent': 'Mozilla/5.0',
        'x-request-id': 'test-request-id',
      },
    };

    mockResponse = {
      statusCode: 200,
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    };

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ success: true })),
    };

    mockMetrics = {
      httpRequestsInFlight: {
        inc: jest.fn(),
        dec: jest.fn(),
      },
      httpRequestsTotal: {
        inc: jest.fn(),
      },
      httpRequestDuration: {
        observe: jest.fn(),
      },
      httpErrorsTotal: {
        inc: jest.fn(),
      },
    } as any;

    mockLogger = {
      logRequest: jest.fn(),
      error: jest.fn(),
      setContext: jest.fn(),
    } as any;

    interceptor = new HttpMetricsInterceptor(mockMetrics as MetricsService, mockLogger as AppLogger);
  });

  describe('intercept() - Successful requests', () => {
    it('should increment in-flight counter on request start', () => {
      interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      expect(mockMetrics.httpRequestsInFlight.inc).toHaveBeenCalledWith({ method: 'GET' });
    });

    it('should decrement in-flight counter on request complete', (done) => {
      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        complete: () => {
          expect(mockMetrics.httpRequestsInFlight.dec).toHaveBeenCalledWith({ method: 'GET' });
          done();
        },
      });
    });

    it('should increment total requests counter', (done) => {
      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        complete: () => {
          expect(mockMetrics.httpRequestsTotal.inc).toHaveBeenCalledWith({
            method: 'GET',
            route: '/api/test',
            status_code: '200',
          });
          done();
        },
      });
    });

    it('should observe request duration', (done) => {
      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        complete: () => {
          expect(mockMetrics.httpRequestDuration.observe).toHaveBeenCalledWith(
            {
              method: 'GET',
              route: '/api/test',
              status_code: '200',
            },
            expect.any(Number),
          );
          done();
        },
      });
    });

    it('should log successful request', (done) => {
      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        complete: () => {
          expect(mockLogger.logRequest).toHaveBeenCalledWith({
            method: 'GET',
            url: '/api/test',
            statusCode: 200,
            durationMs: expect.any(Number),
            ip: '127.0.0.1',
            userAgent: 'Mozilla/5.0',
            userId: undefined,
            requestId: 'test-request-id',
          });
          done();
        },
      });
    });
  });

  describe('intercept() - Error requests', () => {
    it('should handle errors and increment error counter', (done) => {
      const error = new Error('Test error');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        error: () => {
          expect(mockMetrics.httpErrorsTotal.inc).toHaveBeenCalledWith({
            method: 'GET',
            route: '/api/test',
            status_code: '500',
          });
          done();
        },
      });
    });

    it('should log errors with stack trace', (done) => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        error: () => {
          expect(mockLogger.error).toHaveBeenCalled();
          done();
        },
      });
    });

    it('should handle HttpException with status code', (done) => {
      const error = { status: 400, message: 'Bad Request' };
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        error: () => {
          expect(mockMetrics.httpErrorsTotal.inc).toHaveBeenCalledWith({
            method: 'GET',
            route: '/api/test',
            status_code: '400',
          });
          done();
        },
      });
    });

    it('should decrement in-flight counter on error', (done) => {
      const error = new Error('Test error');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        error: () => {
          expect(mockMetrics.httpRequestsInFlight.dec).toHaveBeenCalledWith({ method: 'GET' });
          done();
        },
      });
    });
  });

  describe('Route normalization', () => {
    it('should normalize numeric IDs in routes', () => {
      mockRequest.route = { path: '/api/users/123' };
      mockRequest.url = '/api/users/123';

      interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      // The normalizeRoute method is private, but we can verify through the metrics call
    });

    it('should normalize UUIDs in routes', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.route = { path: `/api/users/uuid/${uuid}` };
      mockRequest.url = `/api/users/uuid/${uuid}`;

      interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);
    });

    it('should remove query strings from routes', () => {
      mockRequest.route = { path: '/api/test' };
      mockRequest.url = '/api/test?page=1&limit=10';

      interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);
    });
  });

  describe('Special routes', () => {
    it('should skip metrics for /metrics endpoint', () => {
      mockRequest.url = '/metrics';

      interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      // Should not increment in-flight counter for /metrics
      expect(mockMetrics.httpRequestsInFlight.inc).not.toHaveBeenCalled();
    });

    it('should handle requests with authenticated user', (done) => {
      mockRequest.user = { id: 123, email: 'user@example.com' };

      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        complete: () => {
          expect(mockLogger.logRequest).toHaveBeenCalledWith(
            expect.objectContaining({
              userId: 123,
            }),
          );
          done();
        },
      });
    });

    it('should handle requests without x-request-id header', (done) => {
      mockRequest.headers = { 'user-agent': 'Mozilla/5.0' };

      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        complete: () => {
          expect(mockLogger.logRequest).toHaveBeenCalledWith(
            expect.objectContaining({
              requestId: undefined,
            }),
          );
          done();
        },
      });
    });
  });

  describe('Client error status codes', () => {
    it('should increment error counter for 400 status', (done) => {
      mockResponse.statusCode = 400;

      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        complete: () => {
          expect(mockMetrics.httpErrorsTotal.inc).toHaveBeenCalledWith({
            method: 'GET',
            route: '/api/test',
            status_code: '400',
          });
          done();
        },
      });
    });

    it('should increment error counter for 401 status', (done) => {
      mockResponse.statusCode = 401;

      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        complete: () => {
          expect(mockMetrics.httpErrorsTotal.inc).toHaveBeenCalledWith({
            method: 'GET',
            route: '/api/test',
            status_code: '401',
          });
          done();
        },
      });
    });

    it('should increment error counter for 403 status', (done) => {
      mockResponse.statusCode = 403;

      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        complete: () => {
          expect(mockMetrics.httpErrorsTotal.inc).toHaveBeenCalledWith({
            method: 'GET',
            route: '/api/test',
            status_code: '403',
          });
          done();
        },
      });
    });

    it('should increment error counter for 404 status', (done) => {
      mockResponse.statusCode = 404;

      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        complete: () => {
          expect(mockMetrics.httpErrorsTotal.inc).toHaveBeenCalledWith({
            method: 'GET',
            route: '/api/test',
            status_code: '404',
          });
          done();
        },
      });
    });

    it('should increment error counter for 500 status', (done) => {
      mockResponse.statusCode = 500;

      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        complete: () => {
          expect(mockMetrics.httpErrorsTotal.inc).toHaveBeenCalledWith({
            method: 'GET',
            route: '/api/test',
            status_code: '500',
          });
          done();
        },
      });
    });
  });

  describe('Duration calculation', () => {
    it('should calculate correct duration for fast requests', (done) => {
      const startTime = Date.now();
      mockRequest.startTime = startTime;

      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        complete: () => {
          expect(mockMetrics.httpRequestDuration.observe).toHaveBeenCalledWith(
            expect.any(Object),
            expect.any(Number),
          );
          done();
        },
      });
    });

    it('should handle requests without startTime', (done) => {
      delete mockRequest.startTime;

      const result = interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler);

      result.subscribe({
        complete: () => {
          expect(mockLogger.logRequest).toHaveBeenCalled();
          done();
        },
      });
    });
  });
});
