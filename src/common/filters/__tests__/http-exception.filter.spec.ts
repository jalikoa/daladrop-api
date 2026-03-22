import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { HttpExceptionFilter } from '../http-exception.filter';
import { AppLogger } from 'src/modules/logger/logger.service';

/**
 * Unit Tests for HttpExceptionFilter
 */
describe('HttpExceptionFilter - Unit Tests', () => {
  let filter: HttpExceptionFilter;
  let mockLogger: Partial<AppLogger>;
  let mockResponse: Partial<Response>;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      setContext: jest.fn(),
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      headersSent: false,
    } as any;

    mockRequest = {
      url: '/api/test',
      method: 'GET',
      startTime: Date.now() - 100,
      requestId: 'test-request-id',
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    };

    filter = new HttpExceptionFilter(mockLogger as AppLogger);
  });

  describe('catch() - HttpException handling', () => {
    it('should handle BadRequestException (400)', () => {
      const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Bad Request',
        }),
      );
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle UnauthorizedException (401)', () => {
      const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Unauthorized',
        }),
      );
    });

    it('should handle ForbiddenException (403)', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: 'Forbidden',
        }),
      );
    });

    it('should handle NotFoundException (404)', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Not Found',
        }),
      );
    });

    it('should handle InternalServerErrorException (500)', () => {
      const exception = new HttpException('Internal Error', HttpStatus.INTERNAL_SERVER_ERROR);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Internal Error',
        }),
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle ConflictException (409)', () => {
      const exception = new HttpException('Conflict', HttpStatus.CONFLICT);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 409,
          message: 'Conflict',
        }),
      );
    });

    it('should handle UnprocessableEntityException (422)', () => {
      const exception = new HttpException('Unprocessable Entity', HttpStatus.UNPROCESSABLE_ENTITY);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 422,
          message: 'Unprocessable Entity',
        }),
      );
    });

    it('should handle TooManyRequestsException (429)', () => {
      const exception = new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 429,
          message: 'Too Many Requests',
        }),
      );
    });
  });

  describe('catch() - Non-HttpException errors', () => {
    it('should handle generic Error objects', () => {
      const exception = new Error('Something went wrong');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Something went wrong',
        }),
      );
    });

    it('should handle non-Error objects', () => {
      const exception = { message: 'Unknown error' };

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Internal server error',
        }),
      );
    });

    it('should include stack trace for Error objects', () => {
      const exception = new Error('Test error');
      exception.stack = 'Error: Test error\n    at test.js:1:1';

      filter.catch(exception, mockHost);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  describe('catch() - Response handling', () => {
    it('should not send response if headers already sent', () => {
      mockResponse.headersSent = true;
      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should include timestamp in response', () => {
      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.timestamp).toBeDefined();
      expect(new Date(response.timestamp)).toBeInstanceOf(Date);
    });

    it('should include path in response', () => {
      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.path).toBe('/api/test');
    });
  });

  describe('Logging behavior', () => {
    it('should log client errors (4xx) as warnings', () => {
      const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should log server errors (5xx) as errors with stack', () => {
      const exception = new HttpException('Internal Error', HttpStatus.INTERNAL_SERVER_ERROR);
      exception.stack = 'Error stack trace';

      filter.catch(exception, mockHost);

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should include request duration in log data', () => {
      mockRequest.startTime = Date.now() - 200;
      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          durationMs: expect.any(Number),
        }),
      );
    });

    it('should include request ID in log data', () => {
      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          requestId: 'test-request-id',
        }),
      );
    });
  });

  describe('HttpException with object response', () => {
    it('should extract message from object response', () => {
      const exception = new HttpException(
        { message: 'Custom message', code: 'CUSTOM_ERROR' },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Custom message',
        }),
      );
    });

    it('should handle nested message array', () => {
      const exception = new HttpException(
        { message: ['Field is required'], code: 'VALIDATION_ERROR' },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: ['Field is required'],
        }),
      );
    });
  });
});
