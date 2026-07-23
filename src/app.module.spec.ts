import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    /**
     * Note: In a large application, you would mock heavy global modules 
     * (like TypeOrmModule or BullModule) here to prevent them from 
     * attempting real database or Redis connections during unit tests.
     * For this base test, we verify the core module definition compiles.
     */
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  it('should be defined and compile successfully', () => {
    expect(module).toBeDefined();
  });

  it('should provide AppController', () => {
    const controller = module.get<AppController>(AppController);
    expect(controller).toBeDefined();
  });

  it('should provide AppService', () => {
    const service = module.get<AppService>(AppService);
    expect(service).toBeDefined();
  });
});