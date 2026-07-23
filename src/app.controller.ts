import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Root endpoint handler.
   * Returns basic API metadata and operational status.
   * Useful for quick uptime checks, load balancer health probes,
   * and verifying the active environment without deep inspection.
   */
  @Get()
  getApiInfo() {
    return this.appService.getApiInfo();
  }
}