import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  /**
   * Mock implementation of AppService to isolate the controller 
   * from the actual service logic during unit testing.
   */
  const mockAppService = {
    getApiInfo: jest.fn().mockReturnValue({
      name: 'API',
      version: '1.0.0',
      environment: 'test',
      status: 'operational',
      timestamp: '2026-07-23T12:00:00.000Z',
    }),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('root', () => {
    it('should call AppService.getApiInfo exactly once', () => {
      appController.getApiInfo();
      expect(appService.getApiInfo).toHaveBeenCalledTimes(1);
    });

    it('should return the API info object provided by AppService', () => {
      const result = appController.getApiInfo();
      
      expect(result).toEqual({
        name: 'HMS API',
        version: '1.0.0',
        environment: 'test',
        status: 'operational',
        timestamp: '2026-07-23T12:00:00.000Z',
      });
    });
  });
});