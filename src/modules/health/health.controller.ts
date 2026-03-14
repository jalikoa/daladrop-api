import { Controller, Get, UseGuards } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthCheckResultDto, SystemMetricsDto } from './dto/health-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async healthCheck(): Promise<HealthCheckResultDto> {
    const checks = await this.healthService.checkAll();
    const allUp = Object.values(checks).every((c) => c.status === 'up');

    return {
      status: allUp ? 'ok' : 'error',
      info: allUp ? checks : undefined,
      error: !allUp ? checks : undefined,
      timestamp: new Date(),
    };
  }

  @Get('ready')
  async readinessCheck(): Promise<{ status: string }> {
    const isReady = await this.healthService.checkReady();
    return { status: isReady ? 'ready' : 'not_ready' };
  }

  @Get('metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async metrics(): Promise<SystemMetricsDto> {
    return this.healthService.getMetrics() as SystemMetricsDto;
  }

  @Get('version')
  async version(): Promise<{ version: string; environment: string }> {
    return {
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
