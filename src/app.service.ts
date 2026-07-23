import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Returns basic API metadata and operational status.
   * Useful for quick uptime checks, load balancer health probes, 
   * and verifying the active environment without deep inspection.
   */
  getApiInfo() {
    return {

      /**
       * Replace API with your actual project name and version with your current version.
       * */

      name: 'API',
      version: '1.0.0',
      environment: this.configService.get('NODE_ENV', 'development'),
      status: 'operational',
      timestamp: new Date().toISOString(),
    };
  }
}