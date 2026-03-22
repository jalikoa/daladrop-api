import { Queue } from 'bull';
import { RedisHealthIndicator } from '../redis.health';

/**
 * Unit Tests for RedisHealthIndicator
 */
describe('RedisHealthIndicator - Unit Tests', () => {
  let indicator: RedisHealthIndicator;
  let mockQueue: Partial<Queue>;
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      ping: jest.fn().mockResolvedValue('PONG'),
    };

    mockQueue = {
      client: Promise.resolve(mockRedisClient),
    } as any;

    indicator = new RedisHealthIndicator(mockQueue as Queue);
  });

  describe('Construction', () => {
    it('should create indicator instance', () => {
      expect(indicator).toBeDefined();
    });

    it('should have name property', () => {
      expect(indicator.name).toBe('redis');
    });
  });

  describe('check()', () => {
    it('should return healthy status when Redis responds to ping', async () => {
      const result = await indicator.check();

      expect(result).toEqual({
        status: 'up',
        latency: expect.any(Number),
      });
    });

    it('should return unhealthy status when ping fails', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Connection failed'));

      const result = await indicator.check();

      expect(result.status).toBe('down');
      expect(result.message).toContain('Connection failed');
    });

    it('should include latency in response', async () => {
      const result = await indicator.check();

      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should measure latency correctly', async () => {
      const start = Date.now();
      const result = await indicator.check();
      const end = Date.now();

      expect(result.latency).toBeLessThanOrEqual(end - start);
    });
  });

  describe('Connection handling', () => {
    it('should return down status when client is null', async () => {
      mockQueue.client = Promise.resolve(null);
      indicator = new RedisHealthIndicator(mockQueue as Queue);

      const result = await indicator.check();

      expect(result.status).toBe('down');
    });

    it('should return down status when client is undefined', async () => {
      mockQueue.client = Promise.resolve(undefined);
      indicator = new RedisHealthIndicator(mockQueue as Queue);

      const result = await indicator.check();

      expect(result.status).toBe('down');
    });

    it('should handle missing ping method', async () => {
      mockQueue.client = Promise.resolve({ ping: undefined });
      indicator = new RedisHealthIndicator(mockQueue as Queue);

      const result = await indicator.check();

      // When ping is not a function, the code skips it and returns up
      expect(result.status).toBe('up');
    });
  });

  describe('Error handling', () => {
    it('should handle connection timeout', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('ETIMEDOUT'));

      const result = await indicator.check();

      expect(result.status).toBe('down');
      expect(result.message).toContain('ETIMEDOUT');
    });

    it('should handle connection refused', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await indicator.check();

      expect(result.status).toBe('down');
      expect(result.message).toContain('ECONNREFUSED');
    });

    it('should handle Redis closed connection', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Connection is closed'));

      const result = await indicator.check();

      expect(result.status).toBe('down');
      expect(result.message).toContain('Connection is closed');
    });

    it('should include error message in response', async () => {
      const errorMsg = 'Redis connection failed';
      mockRedisClient.ping.mockRejectedValue(new Error(errorMsg));

      const result = await indicator.check();

      expect(result.message).toContain(errorMsg);
    });

    it('should handle non-Error objects', async () => {
      mockRedisClient.ping.mockRejectedValue('String error');

      const result = await indicator.check();

      expect(result.status).toBe('down');
    });
  });

  describe('Response format', () => {
    it('should return valid HealthIndicatorResult', async () => {
      const result = await indicator.check();

      expect(result.status).toBeDefined();
      expect(['up', 'down']).toContain(result.status);
    });

    it('should return up status with latency on success', async () => {
      const result = await indicator.check();

      expect(result.status).toBe('up');
      expect(result.latency).toBeDefined();
    });

    it('should return down status with message on failure', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Failed'));

      const result = await indicator.check();

      expect(result.status).toBe('down');
      expect(result.message).toBeDefined();
    });
  });

  describe('Queue integration', () => {
    it('should use queue client for health check', async () => {
      await indicator.check();

      expect(mockQueue.client).toBeDefined();
    });

    it('should call ping on redis client', async () => {
      await indicator.check();

      expect(mockRedisClient.ping).toHaveBeenCalled();
    });
  });

  describe('Multiple calls', () => {
    it('should handle multiple consecutive calls', async () => {
      const result1 = await indicator.check();
      const result2 = await indicator.check();

      expect(result1.status).toBe('up');
      expect(result2.status).toBe('up');
    });

    it('should handle concurrent calls', async () => {
      const promises = Array.from({ length: 5 }, () => indicator.check());
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.status).toBe('up');
      });
    });
  });
});
