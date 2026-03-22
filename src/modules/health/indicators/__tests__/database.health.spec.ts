import { DataSource } from 'typeorm';
import { DatabaseHealthIndicator } from '../database.health';

/**
 * Unit Tests for DatabaseHealthIndicator
 */
describe('DatabaseHealthIndicator - Unit Tests', () => {
  let indicator: DatabaseHealthIndicator;
  let mockDataSource: Partial<DataSource>;

  beforeEach(() => {
    mockDataSource = {
      query: jest.fn().mockResolvedValue([{ '1': 1 }]),
    } as any;

    indicator = new DatabaseHealthIndicator(mockDataSource as DataSource);
  });

  describe('Construction', () => {
    it('should create indicator instance', () => {
      expect(indicator).toBeDefined();
    });

    it('should have name property', () => {
      expect(indicator.name).toBe('database');
    });
  });

  describe('check()', () => {
    it('should return healthy status when database query succeeds', async () => {
      const result = await indicator.check();

      expect(result).toEqual({
        status: 'up',
        latency: expect.any(Number),
      });
    });

    it('should return unhealthy status when query fails', async () => {
      (mockDataSource.query as jest.Mock).mockRejectedValue(new Error('Connection failed'));

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

    it('should call query method with SELECT 1', async () => {
      await indicator.check();

      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
    });
  });

  describe('Connection handling', () => {
    it('should return down status when query throws', async () => {
      (mockDataSource.query as jest.Mock).mockRejectedValue(new Error('Not connected'));

      const result = await indicator.check();

      expect(result.status).toBe('down');
    });

    it('should handle null datasource', async () => {
      const nullIndicator = new DatabaseHealthIndicator(null as any);

      const result = await nullIndicator.check();

      expect(result.status).toBe('down');
      expect(result.message).toContain('Cannot read properties');
    });

    it('should handle undefined datasource', async () => {
      const nullIndicator = new DatabaseHealthIndicator(undefined as any);

      const result = await nullIndicator.check();

      expect(result.status).toBe('down');
    });
  });

  describe('Error handling', () => {
    it('should handle connection timeout', async () => {
      (mockDataSource.query as jest.Mock).mockRejectedValue(new Error('ETIMEDOUT'));

      const result = await indicator.check();

      expect(result.status).toBe('down');
      expect(result.message).toContain('ETIMEDOUT');
    });

    it('should handle connection refused', async () => {
      (mockDataSource.query as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await indicator.check();

      expect(result.status).toBe('down');
      expect(result.message).toContain('ECONNREFUSED');
    });

    it('should handle query error', async () => {
      (mockDataSource.query as jest.Mock).mockRejectedValue(new Error('SQL syntax error'));

      const result = await indicator.check();

      expect(result.status).toBe('down');
      expect(result.message).toContain('SQL syntax error');
    });

    it('should include error message in response', async () => {
      const errorMsg = 'Database connection failed';
      (mockDataSource.query as jest.Mock).mockRejectedValue(new Error(errorMsg));

      const result = await indicator.check();

      expect(result.message).toContain(errorMsg);
    });

    it('should handle non-Error objects', async () => {
      (mockDataSource.query as jest.Mock).mockRejectedValue('String error');

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
      (mockDataSource.query as jest.Mock).mockRejectedValue(new Error('Failed'));

      const result = await indicator.check();

      expect(result.status).toBe('down');
      expect(result.message).toBeDefined();
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

  describe('DataSource integration', () => {
    it('should use dataSource for health check', async () => {
      await indicator.check();

      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should call SELECT 1 query', async () => {
      await indicator.check();

      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
    });
  });
});
