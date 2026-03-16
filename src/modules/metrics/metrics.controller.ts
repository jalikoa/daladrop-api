import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsAuthGuard } from './guards/metrics-auth.guard';
import { UserRole } from '../users/enums/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('metrics')
@UseGuards(MetricsAuthGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}