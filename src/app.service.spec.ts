import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;
  let configService: ConfigService;

  /**
   * Mock implementation of ConfigService to isolate the AppService 
   * from the actual environment during unit testing.
   */
  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'NODE_ENV') return 'test';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('getApiInfo', () => {
    it('should return API metadata with the correct structure', () => {
      const result = service.getApiInfo();

      expect(result).toHaveProperty('name', 'HMS API');
      expect(result).toHaveProperty('version', '1.0.0');
      expect(result).toHaveProperty('environment', 'test');
      expect(result).toHaveProperty('status', 'operational');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
    });

    it('should use the default environment if NODE_ENV is not set', () => {
      /**
       * Force the mock to return undefined to test the fallback logic.
       */
      jest.spyOn(configService, 'get').mockReturnValue(undefined);
      
      const result = service.getApiInfo();
      
      expect(result.environment).toBe('development');
    });
  });
});