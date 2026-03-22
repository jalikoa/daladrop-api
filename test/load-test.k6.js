/**
 * k6 Load Testing Script
 * 
 * Run with: k6 run load-test.k6.js
 * 
 * Install k6: https://k6.io/docs/getting-started/installation/
 * 
 * This script tests the NFC Payment API under load.
 * Configure environment variables:
 *   - BASE_URL: API base URL (default: http://localhost:3000)
 *   - AUTH_TOKEN: JWT token for authenticated requests
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const paymentResponseTime = new Trend('payment_response_time');
const authResponseTime = new Trend('auth_response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 100 }, // Ramp up to 100 users
    { duration: '2m', target: 100 },  // Stay at 100 users (peak load)
    { duration: '30s', target: 50 },  // Ramp down to 50 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should complete below 500ms
    errors: ['rate<0.01'],            // Error rate should be less than 1%
    payment_response_time: ['p(95)<1000'], // Payment endpoints < 1s
    auth_response_time: ['p(95)<500'],     // Auth endpoints < 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Test data
const testCredentials = {
  email: 'admin@nfcapi.com',
  password: 'AdminPass123!',
};

export default function () {
  // Health check (light load)
  checkHealth();
  sleep(1);

  // Authentication flow
  const token = authenticate();
  sleep(1);

  // Payment flow (if authenticated)
  if (token) {
    testPaymentFlow(token);
  }
  sleep(2);

  // Webhook simulation
  testWebhook();
  sleep(1);
}

function checkHealth() {
  const res = http.get(`${BASE_URL}/health`);
  
  const success = check(res, {
    'health check status is 200': (r) => r.status === 200,
    'health check has status field': (r) => JSON.parse(r.body).status !== undefined,
  });

  errorRate.add(success ? 0 : 1);
}

function authenticate() {
  const payload = JSON.stringify(testCredentials);
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/auth/login`, payload, params);
  
  const startTime = Date.now();
  
  const success = check(res, {
    'login status is 201': (r) => r.status === 201,
    'login returns access_token': (r) => {
      const body = JSON.parse(r.body);
      return body.access_token !== undefined;
    },
    'login returns refresh_token': (r) => {
      const body = JSON.parse(r.body);
      return body.refresh_token !== undefined;
    },
  });

  authResponseTime.add(Date.now() - startTime);
  errorRate.add(success ? 0 : 1);

  if (success) {
    return JSON.parse(res.body).access_token;
  }
  return null;
}

function testPaymentFlow(token) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };

  // Test payment validation (without actual STK push)
  const invalidPayload = JSON.stringify({
    amount: 0, // Invalid amount
    phone: 'invalid',
    merchant_id: 1,
  });

  const res = http.post(`${BASE_URL}/payments/stk`, invalidPayload, params);
  
  const startTime = Date.now();
  
  // We expect 400 for invalid data
  const success = check(res, {
    'payment validation returns 400': (r) => r.status === 400,
  });

  paymentResponseTime.add(Date.now() - startTime);
  errorRate.add(success ? 0 : 1);

  sleep(0.5);

  // Test NFC token decoding
  const decodeRes = http.get(`${BASE_URL}/pay?token=test-token`);
  check(decodeRes, {
    'decode invalid token returns 400': (r) => r.status === 400,
  });
}

function testWebhook() {
  const payload = JSON.stringify({
    Body: {
      stkCallback: {
        MerchantRequestID: 'test-123',
        CheckoutRequestID: 'ws_CO_123',
        ResultCode: 0,
        ResultDesc: 'Success',
      },
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/webhooks/daraja/stk`, payload, params);
  
  const success = check(res, {
    'webhook status is 200': (r) => r.status === 200,
  });

  errorRate.add(success ? 0 : 1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    './reports/k6-results.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  return `
📊 k6 Load Test Summary
${'='.repeat(50)}

Execution Time: ${data.state.testRunDurationMs.toFixed(0)}ms
Total Requests: ${data.metrics.http_reqs.values.count}
Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s

Response Times:
  Min:    ${data.metrics.http_req_duration.values.min.toFixed(2)}ms
  Max:    ${data.metrics.http_req_duration.values.max.toFixed(2)}ms
  Avg:    ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
  Median: ${data.metrics.http_req_duration.values['med'].toFixed(2)}ms
  P95:    ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
  P99:    ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms

Thresholds:
  ${data.metrics.http_req_duration.thresholds ? 
    Object.entries(data.metrics.http_req_duration.thresholds).map(([k, v]) => 
      `${k}: ${v.ok ? '✓' : '✗'}`
    ).join('\n  ') : 'N/A'}

Error Rate: ${(data.metrics.errors?.values?.rate || 0) * 100}%
`;
}
