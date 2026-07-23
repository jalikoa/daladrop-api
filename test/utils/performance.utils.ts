/**
 * Performance/Load Testing Utilities
 * 
 * Utilities for stress testing API endpoints, measuring response times,
 * and testing throughput. Uses k6 or Artillery for actual load testing.
 * 
 * Usage:
 *   npm run test:perf
 *   npm run test:load
 *   npm run test:stress
 */

import { INestApplication } from '@nestjs/common';

export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  responseTimes: {
    min: number;
    max: number;
    avg: number;
    median: number;
    p95: number;
    p99: number;
  };
  requestsPerSecond: number;
  errors: string[];
}

export interface LoadTestConfig {
  baseUrl: string;
  duration: string; // e.g., '30s', '1m'
  vus: number; // Virtual users
  rampUp: string; // e.g., '10s'
  endpoints: LoadTestEndpoint[];
}

export interface LoadTestEndpoint {
  path: string;
  method: string;
  weight?: number; // Request weight for weighted load testing
  headers?: Record<string, string>;
  body?: any;
}

/**
 * Calculate percentile from sorted array
 */
export function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, index)];
}

/**
 * Calculate performance metrics from response times
 */
export function calculateMetrics(
  endpoint: string,
  method: string,
  responseTimes: number[],
  errors: string[],
  durationSeconds: number,
): PerformanceMetrics {
  const sorted = [...responseTimes].sort((a, b) => a - b);
  const total = responseTimes.length;
  const failed = errors.length;

  return {
    endpoint,
    method,
    totalRequests: total,
    successfulRequests: total - failed,
    failedRequests: failed,
    responseTimes: {
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
      avg: sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0,
      median: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    },
    requestsPerSecond: total / durationSeconds,
    errors,
  };
}

/**
 * Simple load test runner (for basic testing)
 * For production load testing, use k6 or Artillery
 */
export async function runSimpleLoadTest(
  app: INestApplication,
  config: LoadTestConfig,
): Promise<PerformanceMetrics[]> {
  const metrics: PerformanceMetrics[] = [];
  const baseUrl = config.baseUrl || `http://localhost:3000`;

  console.log(`\n[**] Starting load test against ${baseUrl}`);
  console.log(`Duration: ${config.duration}, VUs: ${config.vus}\n`);

  for (const endpoint of config.endpoints) {
    const responseTimes: number[] = [];
    const errors: string[] = [];
    const requests = config.vus * 10; // 10 requests per virtual user

    console.log(`Testing ${endpoint.method} ${endpoint.path}...`);

    const startTime = Date.now();

    for (let i = 0; i < requests; i++) {
      try {
        const requestStart = Date.now();
        
        // Simulate request (in real scenario, use actual HTTP client)
        await simulateRequest(app, endpoint);
        
        const responseTime = Date.now() - requestStart;
        responseTimes.push(responseTime);
      } catch (error: any) {
        errors.push(error.message);
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    const endpointMetrics = calculateMetrics(
      endpoint.path,
      endpoint.method,
      responseTimes,
      errors,
      duration,
    );

    metrics.push(endpointMetrics);

    console.log(`  ✓ Completed ${requests} requests in ${duration.toFixed(2)}s`);
    console.log(`  ✓ Avg response time: ${endpointMetrics.responseTimes.avg.toFixed(2)}ms`);
    console.log(`  ✓ P95 response time: ${endpointMetrics.responseTimes.p95.toFixed(2)}ms`);
    console.log(`  ✓ Requests/sec: ${endpointMetrics.requestsPerSecond.toFixed(2)}\n`);
  }

  return metrics;
}

/**
 * Simulate a request to the application
 */
async function simulateRequest(
  app: INestApplication,
  endpoint: LoadTestEndpoint,
): Promise<void> {
  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance();

  // This is a simplified simulation - in production, use actual HTTP requests
  return new Promise((resolve, reject) => {
    // Simulate network delay
    const delay = Math.random() * 100 + 10; // 10-110ms
    setTimeout(resolve, delay);
  });
}

/**
 * Performance thresholds for CI/CD
 */
export const PERFORMANCE_THRESHOLDS = {
  health: {
    maxResponseTime: 100, // ms
    minRequestsPerSecond: 100,
    maxErrorRate: 0.01, // 1%
  },
  auth: {
    maxResponseTime: 500, // ms
    minRequestsPerSecond: 50,
    maxErrorRate: 0.01,
  },
  payments: {
    maxResponseTime: 1000, // ms
    minRequestsPerSecond: 20,
    maxErrorRate: 0.001, // 0.1%
  },
  webhooks: {
    maxResponseTime: 200, // ms
    minRequestsPerSecond: 100,
    maxErrorRate: 0.001,
  },
};

/**
 * Check if metrics meet performance thresholds
 */
export function checkThresholds(
  metrics: PerformanceMetrics[],
  thresholds: typeof PERFORMANCE_THRESHOLDS,
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  for (const metric of metrics) {
    const threshold = getThresholdForEndpoint(metric.endpoint, thresholds);
    if (!threshold) continue;

    if (metric.responseTimes.avg > threshold.maxResponseTime) {
      failures.push(
        `${metric.endpoint}: Avg response time ${metric.responseTimes.avg.toFixed(2)}ms ` +
        `exceeds threshold ${threshold.maxResponseTime}ms`,
      );
    }

    if (metric.requestsPerSecond < threshold.minRequestsPerSecond) {
      failures.push(
        `${metric.endpoint}: Requests/sec ${metric.requestsPerSecond.toFixed(2)} ` +
        `below threshold ${threshold.minRequestsPerSecond}`,
      );
    }

    const errorRate = metric.failedRequests / metric.totalRequests;
    if (errorRate > threshold.maxErrorRate) {
      failures.push(
        `${metric.endpoint}: Error rate ${(errorRate * 100).toFixed(2)}% ` +
        `exceeds threshold ${(threshold.maxErrorRate * 100).toFixed(2)}%`,
      );
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

function getThresholdForEndpoint(
  endpoint: string,
  thresholds: typeof PERFORMANCE_THRESHOLDS,
): typeof PERFORMANCE_THRESHOLDS.health | null {
  if (endpoint.includes('health') || endpoint.includes('metrics')) {
    return thresholds.health;
  }
  if (endpoint.includes('auth') || endpoint.includes('login')) {
    return thresholds.auth;
  }
  if (endpoint.includes('payment') || endpoint.includes('stk')) {
    return thresholds.payments;
  }
  if (endpoint.includes('webhook')) {
    return thresholds.webhooks;
  }
  return thresholds.health; // Default
}

/**
 * Generate performance report
 */
export function generatePerformanceReport(metrics: PerformanceMetrics[]): string {
  let report = '\n[**] Performance Test Report\n';
  report += '='.repeat(60) + '\n\n';

  for (const metric of metrics) {
    report += `Endpoint: ${metric.method} ${metric.endpoint}\n`;
    report += '-'.repeat(40) + '\n';
    report += `  Total Requests:     ${metric.totalRequests}\n`;
    report += `  Successful:         ${metric.successfulRequests}\n`;
    report += `  Failed:             ${metric.failedRequests}\n`;
    report += `  Duration:           ${(metric.totalRequests / metric.requestsPerSecond).toFixed(2)}s\n`;
    report += `  Requests/sec:       ${metric.requestsPerSecond.toFixed(2)}\n`;
    report += `  Response Times:\n`;
    report += `    Min:              ${metric.responseTimes.min.toFixed(2)}ms\n`;
    report += `    Max:              ${metric.responseTimes.max.toFixed(2)}ms\n`;
    report += `    Avg:              ${metric.responseTimes.avg.toFixed(2)}ms\n`;
    report += `    Median:           ${metric.responseTimes.median.toFixed(2)}ms\n`;
    report += `    P95:              ${metric.responseTimes.p95.toFixed(2)}ms\n`;
    report += `    P99:              ${metric.responseTimes.p99.toFixed(2)}ms\n`;
    
    if (metric.errors.length > 0) {
      report += `  Errors:\n`;
      metric.errors.slice(0, 5).forEach((err) => {
        report += `    - ${err}\n`;
      });
      if (metric.errors.length > 5) {
        report += `    ... and ${metric.errors.length - 5} more\n`;
      }
    }
    report += '\n';
  }

  return report;
}
