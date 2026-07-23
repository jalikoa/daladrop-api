import { validate } from '../env.validation';

/**
 * Unit Tests for Environment Validation
 * 
 * Ensures that the application fails fast on startup if critical 
 * environment variables are missing or malformed.
 */
describe('Environment Validation', () => {
  /**
   * A baseline valid configuration object to use as a starting point 
   * for testing specific invalid scenarios.
   */
  const validConfig = {
    NODE_ENV: 'development',
    PORT: 3000,
    DB_TYPE: 'postgres',
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_USERNAME: 'postgres',
    DB_PASSWORD: 'password',
    DB_NAME: 'test_db',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    JWT_SECRET: 'super-secret-key-12345678901234567890123456789012',
    JWT_EXPIRATION: '1d',
    ENCRYPTION_SECRET_KEY: 'abcdefghijklmnopqrstuvwxyz123456',
    ORM_TYPE: 'prisma',
  };

  it('should pass validation with a complete and valid configuration', () => {
    expect(() => validate(validConfig)).not.toThrow();
  });

  it('should implicitly convert string numbers to actual numbers', () => {
    const configWithStrings = {
      ...validConfig,
      PORT: '8080',
      DB_PORT: '3306',
      REDIS_PORT: '6379',
    };

    const result = validate(configWithStrings);

    expect(result.PORT).toBe(8080);
    expect(result.DB_PORT).toBe(3306);
    expect(result.REDIS_PORT).toBe(6379);
  });

  it('should throw an error if NODE_ENV is invalid', () => {
    const invalidConfig = { ...validConfig, NODE_ENV: 'staging' };

    expect(() => validate(invalidConfig)).toThrow(
      'NODE_ENV must be one of the following values: development, production, test',
    );
  });

  it('should throw an error if required DB fields are missing', () => {
    const { DB_HOST, DB_USERNAME, ...missingDbConfig } = validConfig;

    expect(() => validate(missingDbConfig)).toThrow();
  });

  it('should throw an error if JWT_SECRET is missing', () => {
    const { JWT_SECRET, ...missingJwtConfig } = validConfig;

    expect(() => validate(missingJwtConfig)).toThrow(
      'JWT_SECRET should not be null or undefined',
    );
  });

  it('should throw an error if ENCRYPTION_SECRET_KEY is missing', () => {
    const { ENCRYPTION_SECRET_KEY, ...missingEncConfig } = validConfig;

    expect(() => validate(missingEncConfig)).toThrow(
      'ENCRYPTION_SECRET_KEY should not be null or undefined',
    );
  });

  it('should allow optional observability fields to be missing', () => {
    const minimalValidConfig = { ...validConfig };
    /**
     * Removing all optional observability fields should still pass validation.
     */
    delete (minimalValidConfig as any).LOG_LEVEL;
    delete (minimalValidConfig as any).ELASTICSEARCH_URL;
    delete (minimalValidConfig as any).LOGSTASH_HOST;
    delete (minimalValidConfig as any).METRICS_TOKEN;

    expect(() => validate(minimalValidConfig)).not.toThrow();
  });
});