/****
 * File: patients.controller.spec.ts
 * Module: patients
 * Purpose: Unit tests for PatientsController.
 *
 ****/

import { Test, TestingModule } from '@nestjs/testing';
import { PatientsController } from '../patients.controller';
import { PatientsService } from '../patients.service';

const mockService = {
  findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
};

describe('PatientsController', () => {
  let controller: PatientsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PatientsController],
      providers: [{ provide: PatientsService, useValue: mockService }],
    }).compile();

    controller = module.get<PatientsController>(PatientsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const result = await controller.findAll(1, 10);
      expect(result).toEqual({ data: [], total: 0 });
      expect(mockService.findAll).toHaveBeenCalledWith(1, 10);
    });
  });
});

