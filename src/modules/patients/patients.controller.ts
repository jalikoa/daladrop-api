/****
 * File: patients.controller.ts
 * Module: patients
 * Purpose: HTTP entry point. Routes requests to use-cases with Swagger & Guard decorators.
 *
 ****/

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../../auth/guards/roles.guard';
// import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Patients')
@Controller('patients')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('ADMIN')
// @ApiBearerAuth()
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all patients' })
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.patientsService.findAll(page, limit);
  }
}

