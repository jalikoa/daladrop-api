import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

/**
 * Public Controller
 * 
 * Handles public, unauthenticated endpoints.
 * These endpoints are accessible to anyone and are typically used 
 * for load balancer health probes, API metadata, or public-facing information.
 */
@ApiTags('Public')
@Controller('public')
export class PublicController {
  
  /**
   * Health Check Endpoint
   * 
   * Returns a simple acknowledgment to verify the API process is running 
   * and responsive. This is the ideal endpoint for Kubernetes liveness 
   * probes or AWS ALB health checks.
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check API health status' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'API is healthy and running',
    schema: {
      example: {
        status: 'healthy',
        timestamp: '2026-07-23T12:00:00.000Z',
      }
    }
  })
  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * API Info Endpoint
   * 
   * Returns basic, non-sensitive metadata about the API.
   * Useful for frontend clients or third-party integrations to verify 
   * the API version and current environment without authentication.
   */
  @Get('info')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get basic API metadata' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'API metadata retrieved successfully',
    schema: {
      example: {
        name: 'HMS API',
        version: '1.0.0',
        environment: 'development',
        documentation: '/api/docs',
      }
    }
  })
  getInfo() {
    return {
      name: 'HMS API',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      documentation: '/api/docs',
    };
  }
}